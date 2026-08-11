'use client';

/**
 * The one pair of confirm dialogs for the operator verification decision -
 * shared by the verification queue (row/sheet actions) and the operator edit
 * page (E-15), so the consequence copy can never drift between surfaces.
 *
 * Approve => VERIFIED: the backend immediately sends the OB-2A "You're
 * approved" email and the onboarding drip anchors on the decision date.
 * Reject => REJECTED: nothing is sent; the operator cannot add tours.
 */

import { toast } from 'sonner';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDecideVerification } from '@/hooks/operators/use-operators';
import type { VerificationDecision } from '@/types/operator';

export interface DecisionTarget {
    id: string;
    /** Display name shown in the dialog copy (company or signatory). */
    name: string;
}

interface DecisionDialogProps {
    target: DecisionTarget | null;
    onClose: () => void;
    /** Called after a successful decision (e.g. close the detail sheet). */
    onDecided?: () => void;
}

export function ApproveOperatorDialog(props: DecisionDialogProps) {
    return (
        <DecisionDialog
            {...props}
            decision='VERIFIED'
            title={name => `Approve ${name}?`}
            description={`This marks the operator as Verified, immediately emails them "You're approved" (OB-2A) with the add-your-first-tour link, and starts the onboarding follow-up sequence.`}
            actionLabel='Approve operator'
            pendingLabel='Approving...'
            successToast={name => `${name} approved - the "You're approved" email is on its way.`}
            errorToast='Failed to approve the operator.'
        />
    );
}

export function RejectOperatorDialog(props: DecisionDialogProps) {
    return (
        <DecisionDialog
            {...props}
            decision='REJECTED'
            destructive
            title={name => `Reject ${name}?`}
            description='The operator is marked as Rejected and cannot add tours. No email is sent - let them know the outcome yourself if needed.'
            actionLabel='Reject operator'
            pendingLabel='Rejecting...'
            successToast={name => `${name} rejected. No email was sent.`}
            errorToast='Failed to reject the operator.'
        />
    );
}

function DecisionDialog({
    target,
    onClose,
    onDecided,
    decision,
    destructive,
    title,
    description,
    actionLabel,
    pendingLabel,
    successToast,
    errorToast,
}: DecisionDialogProps & {
    decision: VerificationDecision;
    destructive?: boolean;
    title: (name: string) => string;
    description: string;
    actionLabel: string;
    pendingLabel: string;
    successToast: (name: string) => string;
    errorToast: string;
}) {
    const { mutate: decide, isPending } = useDecideVerification();

    function handleConfirm() {
        if (!target) return;
        const name = target.name;
        decide(
            { id: target.id, decision },
            {
                onSuccess: () => {
                    toast.success(successToast(name));
                    onClose();
                    onDecided?.();
                },
                onError: err =>
                    toast.error(
                        err instanceof Error ? err.message : errorToast,
                    ),
            },
        );
    }

    return (
        <AlertDialog open={!!target} onOpenChange={o => !o && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {target ? title(target.name) : ''}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        variant={destructive ? 'destructive' : 'default'}
                        disabled={isPending}
                        onClick={e => {
                            // Keep the dialog open while the request runs.
                            e.preventDefault();
                            handleConfirm();
                        }}>
                        {isPending ? pendingLabel : actionLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
