'use client';

/**
 * Wizard state (07 §5.3, §6).
 *
 * Holds the three things that must outlive a single step render:
 *
 * - **Navigation**: current step, which steps have been visited, and the
 *   create/edit mode flag that decides whether unvisited steps are reachable.
 * - **Section open/closed state**, keyed `stepId:sectionId`, so Back then
 *   Continue returns the operator to the exact shape they left. A step can
 *   also force a section open when validation fails inside it.
 * - **Step commits**: each step registers how to save itself, so the ONE
 *   sticky footer can drive every step without each step drawing its own
 *   buttons.
 *
 * Engineering notes:
 * - Submit callbacks live in a ref, not state: they are functions, nothing
 *   renders off them, and putting them in state re-rendered the whole shell on
 *   every keystroke that changed a step's `useCallback` identity.
 * - The pending/dirty booleans DO live in state (the footer renders off them)
 *   and are written through an equality guard, otherwise a step re-registering
 *   with identical flags loops.
 * - Registration is keyed by step id rather than "the active step", because
 *   visited steps stay mounted (that is why switching is instant) and would
 *   otherwise clobber each other's registration.
 */

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

import {
    REVIEW_STEP,
    getNextStep,
    getPrevStep,
    getStepIndex,
    type WizardStepId,
} from '@/lib/trips/wizard-steps';

export type WizardMode = 'create' | 'edit';

/** What a step tells the footer about itself. */
export interface StepCommit {
    /**
     * Save this step. Resolve `true` to advance, `false` to stay put (the
     * footer shakes and the step is responsible for showing why).
     * Omit entirely on steps that save through child mutations as you go
     * (media, content lists) - Continue then just advances.
     */
    submit?: () => Promise<boolean>;
    isPending?: boolean;
    isDirty?: boolean;
}

interface WizardContextValue {
    mode: WizardMode;
    tripId: string | null;
    step: WizardStepId;
    stepIndex: number;
    visited: ReadonlySet<WizardStepId>;
    /** True while a step's submit is in flight. */
    isSaving: boolean;
    isDirty: boolean;

    goTo: (step: WizardStepId) => void;
    goNext: () => void;
    goBack: () => void;
    /**
     * Advance PAST the unsaved-changes guard.
     *
     * Only legitimate immediately after `commitCurrentStep()` resolved true.
     * At that instant the step still reports dirty: react-hook-form's
     * `isDirty` clears on `reset(toDefaults(trip))`, which cannot run until the
     * mutation has invalidated the query, the refetch has landed and a new
     * `trip` has propagated down - several ticks after the save resolved. The
     * plain `goNext()` reads that stale flag and asks "Leave this step without
     * saving?" about the click that just saved it.
     */
    goNextAfterSave: () => void;
    /** Can this step be reached by clicking the rail? */
    canNavigateTo: (step: WizardStepId) => boolean;

    /**
     * The active step's save failure, if any. Held here rather than shouted
     * through a toast: a rejected save is not a notification, it is a piece of
     * work the operator still has to do, and it has to survive longer than
     * four seconds and stay next to the form it belongs to.
     */
    stepError: string | null;
    setStepError: (message: string | null) => void;

    isSectionOpen: (sectionId: string, defaultOpen: boolean) => boolean;
    setSectionOpen: (sectionId: string, open: boolean) => void;
    /** Force a section open because validation failed inside it. */
    revealSection: (sectionId: string) => void;

    registerCommit: (
        step: WizardStepId,
        key: string,
        commit: StepCommit,
    ) => () => void;
    /** Runs every submit on the active step. Returns false if any refused. */
    commitCurrentStep: () => Promise<boolean>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
    const ctx = useContext(WizardContext);
    if (!ctx) {
        throw new Error('useWizard must be used inside <WizardProvider>.');
    }
    return ctx;
}

interface WizardProviderProps {
    mode: WizardMode;
    tripId: string | null;
    step: WizardStepId;
    /** Writes the step to the URL - the URL stays the source of truth. */
    onStepChange: (step: WizardStepId, force?: boolean) => void;
    children: ReactNode;
}

export function WizardProvider({
    mode,
    tripId,
    step,
    onStepChange,
    children,
}: WizardProviderProps) {
    const [visited, setVisited] = useState<Set<WizardStepId>>(
        () => new Set([step]),
    );
    const [stepError, setStepError] = useState<string | null>(null);
    // Keyed `step::key`: a step may host more than one independent form (the
    // content step owns both the English copy and the advanced trip settings).
    const [flags, setFlags] = useState<
        Record<string, { isPending: boolean; isDirty: boolean }>
    >({});

    const submits = useRef<
        Record<string, (() => Promise<boolean>) | undefined>
    >({});

    // Track the current step in a ref so `commitCurrentStep` can stay stable
    // across step changes (the footer holds onto it).
    const stepRef = useRef(step);
    stepRef.current = step;

    // Render-time visit tracking (not an effect): the step is visited the
    // moment it renders, and doing it in an effect made the rail lag a frame.
    if (!visited.has(step)) {
        setVisited(prev => {
            if (prev.has(step)) return prev;
            const next = new Set(prev);
            next.add(step);
            return next;
        });
    }

    // An error belongs to the screen that produced it, so leaving the step
    // retires it. Render-time, not an effect, so the banner never survives a
    // frame into the next step.
    const lastErrorStep = useRef(step);
    if (lastErrorStep.current !== step) {
        lastErrorStep.current = step;
        if (stepError !== null) setStepError(null);
    }

    const goTo = useCallback(
        (next: WizardStepId) => {
            if (next === stepRef.current) return;
            onStepChange(next);
        },
        [onStepChange],
    );

    const goNext = useCallback(() => {
        const next = getNextStep(stepRef.current);
        if (next) onStepChange(next);
    }, [onStepChange]);

    const goNextAfterSave = useCallback(() => {
        const next = getNextStep(stepRef.current);
        if (next) onStepChange(next, true);
    }, [onStepChange]);

    const goBack = useCallback(() => {
        const prev = getPrevStep(stepRef.current);
        if (prev) onStepChange(prev);
    }, [onStepChange]);

    const canNavigateTo = useCallback(
        (target: WizardStepId) => {
            // Editing an existing tour is hub-and-spoke: everything is one
            // click away (07 §6). Creating is a walk - you can go back to
            // anything you have seen, but not skip ahead into a step whose
            // inputs may not have a draft to save against yet.
            if (mode === 'edit') return true;
            if (visited.has(target)) return true;
            return getStepIndex(target) <= getStepIndex(stepRef.current);
        },
        [mode, visited],
    );

    /**
     * Accordion state: which ONE section is open, per step.
     *
     * Not a per-section boolean. That model could only close siblings it had
     * already seen, and the step's default-open section has no entry until
     * someone toggles it - so opening a second section left the first one
     * standing, which is the bug this replaced. Recording the single open id
     * makes "everything else is closed" the definition rather than a sweep.
     *
     * `undefined` for a step means untouched, so each section falls back to its
     * own `defaultOpen`. `null` means the operator explicitly closed the last
     * open one - distinct from untouched, otherwise the default would spring
     * back the moment you collapsed it.
     */
    const [openSection, setOpenSection] = useState<
        Record<string, string | null>
    >({});

    const isSectionOpen = useCallback(
        (sectionId: string, defaultOpen: boolean) => {
            const stepKey = sectionId.split(':')[0];
            const current = openSection[stepKey];
            if (current === undefined) return defaultOpen;
            return current === sectionId;
        },
        [openSection],
    );

    const setSectionOpen = useCallback((sectionId: string, open: boolean) => {
        const stepKey = sectionId.split(':')[0];
        setOpenSection(prev => ({
            ...prev,
            [stepKey]: open ? sectionId : null,
        }));
    }, []);

    const revealSection = useCallback((sectionId: string) => {
        // Validation force-open takes the slot outright, so a step with two
        // failing sections does not end up with both hanging open - the first
        // is where `focusFirstInvalid` is sending the operator anyway.
        const stepKey = sectionId.split(':')[0];
        setOpenSection(prev =>
            prev[stepKey] === sectionId
                ? prev
                : { ...prev, [stepKey]: sectionId },
        );
    }, []);

    const registerCommit = useCallback(
        (target: WizardStepId, key: string, commit: StepCommit) => {
            const id = `${target}::${key}`;
            submits.current[id] = commit.submit;
            const isPending = !!commit.isPending;
            const isDirty = !!commit.isDirty;
            setFlags(prev => {
                const current = prev[id];
                if (
                    current &&
                    current.isPending === isPending &&
                    current.isDirty === isDirty
                ) {
                    return prev;
                }
                return { ...prev, [id]: { isPending, isDirty } };
            });
            return () => {
                delete submits.current[id];
                setFlags(prev => {
                    if (!prev[id]) return prev;
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            };
        },
        [],
    );

    /**
     * Runs every form registered on the active step, in mount order, stopping
     * at the first refusal so the operator is left looking at the form that
     * failed rather than at a half-applied step.
     *
     * Sequential, not parallel: two forms on one step could both be spreading
     * `tripToUpdatePayload` and would race on stale values. The standing rule
     * is one trip-core PATCH per step, and running in series keeps a future
     * violation merely wrong rather than nondeterministic.
     */
    const commitCurrentStep = useCallback(async () => {
        const prefix = `${stepRef.current}::`;
        const pending = Object.entries(submits.current)
            .filter(([id, fn]) => id.startsWith(prefix) && fn)
            .map(([, fn]) => fn!);

        for (const submit of pending) {
            if (!(await submit())) return false;
        }
        return true;
    }, []);

    const stepFlags = Object.entries(flags).filter(([id]) =>
        id.startsWith(`${step}::`),
    );
    const isSaving = stepFlags.some(([, f]) => f.isPending);
    const isStepDirty = stepFlags.some(([, f]) => f.isDirty);

    const value = useMemo<WizardContextValue>(
        () => ({
            mode,
            tripId,
            step,
            stepIndex: getStepIndex(step),
            visited,
            isSaving,
            isDirty: isStepDirty,
            goTo,
            goNext,
            goNextAfterSave,
            goBack,
            canNavigateTo,
            stepError,
            setStepError,
            isSectionOpen,
            setSectionOpen,
            revealSection,
            registerCommit,
            commitCurrentStep,
        }),
        [
            mode,
            tripId,
            step,
            visited,
            isSaving,
            isStepDirty,
            stepError,
            goTo,
            goNext,
            goNextAfterSave,
            goBack,
            canNavigateTo,
            isSectionOpen,
            setSectionOpen,
            revealSection,
            registerCommit,
            commitCurrentStep,
        ],
    );

    return (
        <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
    );
}

/** True when the wizard is showing its terminal review hub. */
export function useIsReviewStep(): boolean {
    return useWizard().step === REVIEW_STEP;
}
