'use client';

import {
  Alert02Icon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  CodeIcon,
  Delete02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { SaveError } from '@/components/common/save-error';
import { StatusBadge } from '@/components/common/status-badge';
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateCustomScript,
  useCustomScripts,
  useDeleteCustomScript,
  useReorderCustomScripts,
  useUpdateCustomScript,
} from '@/hooks/custom-scripts/use-custom-scripts';
import { useRole } from '@/contexts/role-context';
import type { CustomScript, CustomScriptPosition } from '@/types/custom-scripts';

import { ScriptEditor } from './script-editor';

// "Header" and "Footer" are the words every vendor's install page uses, so they
// are the words here - an admin should not have to translate the docs they are
// following. The stored enum stays HEAD / BODY_END; only the label differs.
//
// The hints carry the part the label cannot: what actually happens. A "Header"
// script runs before any content is drawn, which is the real reason to pick it,
// and a verification <meta> lands in the page head from either position.
const POSITION_LABEL: Record<CustomScriptPosition, string> = {
  HEAD: 'Header',
  BODY_END: 'Footer',
};

const POSITION_HINT: Record<CustomScriptPosition, string> = {
  HEAD: 'Runs before any content is drawn. Only for consent managers and anti-flicker wrappers - everything here delays the site for every visitor. Verification <meta> and <link> tags are placed in the page head from either position.',
  BODY_END:
    'Runs once the content is on screen. The right answer for analytics, pixels and chat widgets, and where a Tag Manager <noscript> belongs.',
};

interface ScriptDraft {
  name: string;
  description: string;
  position: CustomScriptPosition;
  code: string;
  isActive: boolean;
}

const EMPTY_DRAFT: ScriptDraft = {
  name: '',
  description: '',
  position: 'BODY_END',
  code: '',
  isActive: true,
};

/**
 * Settings > Scripts.
 *
 * One row per snippet rather than a "header scripts" and "footer scripts"
 * textarea pair. The pair is the obvious design and the wrong one: every edit
 * becomes a diff against every other vendor's code in the same box, one broken
 * snippet takes the rest down with it, and there is no way to switch a single
 * tool off while working out which one slowed the site down.
 *
 * The code editor is CodeMirror with GitHub's themes (`script-editor.tsx`).
 * Validation is deliberately NOT mirrored here - the backend's structural
 * allowlist is the single source of truth for what is allowed, and a second copy
 * in the browser would drift and start rejecting snippets the server accepts.
 *
 * The server's reason is rendered IN THE DIALOG, under the Code field, in the
 * same `SaveError` block the trip wizard uses for its step failures. It is far
 * too useful to throw at a toast - "<base> is not allowed", "<script> is never
 * closed", "not valid JavaScript: Unexpected token ':'" all name the exact thing
 * to fix, and a notification that fades in the opposite corner is the worst
 * place to put something you have to read twice while scanning 40 lines of
 * pasted vendor code.
 */
export function CustomScriptsForm() {
  const { data: scripts = [], isLoading } = useCustomScripts();
  const { can } = useRole();
  const create = useCreateCustomScript();
  const update = useUpdateCustomScript();
  const reorder = useReorderCustomScripts();
  const remove = useDeleteCustomScript();

  const [editing, setEditing] = useState<CustomScript | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CustomScript | null>(null);

  const canManage = can('MANAGE_SETTINGS');
  const isBusy = update.isPending || reorder.isPending || create.isPending;

  // Grouped by position, because that is how they execute - a flat list would
  // put a head snippet next to a body one and imply an order that is not real.
  const byPosition = (position: CustomScriptPosition) =>
    scripts
      .filter((script) => script.position === position)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));

  /** Reorder within ONE position; the other group's order is untouched. */
  function handleMove(
    position: CustomScriptPosition,
    index: number,
    direction: 'up' | 'down',
  ) {
    const group = byPosition(position);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= group.length) return;

    const next = [...group];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({
      items: next.map((script, i) => ({ id: script.id, displayOrder: i })),
    });
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold">
              Custom Scripts
            </CardTitle>
            <CardDescription className="mt-1">
              Vendor snippets injected into every public page. Add one per tool
              so you can switch them off independently.
            </CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
              Add script
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Said once, plainly, at the top - not buried in a field hint. Anyone
            pasting here is adding code that runs on the checkout. */}
        <p className="flex items-start gap-2 rounded-md bg-surface-inset p-3 text-xs text-content-muted">
          <HugeiconsIcon
            icon={Alert02Icon}
            className="mt-px size-3.5 shrink-0"
          />
          <span>
            These run on every page, including checkout. Only paste code from a
            vendor you trust - it can read anything on the page. Snippets are
            stored exactly as pasted, so integrity hashes keep working.
          </span>
        </p>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : scripts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line py-16 text-content-muted">
            <HugeiconsIcon icon={CodeIcon} className="size-10 opacity-30" />
            <p className="text-sm">No custom scripts yet.</p>
          </div>
        ) : (
          (['HEAD', 'BODY_END'] as const).map((position) => {
            const group = byPosition(position);
            if (group.length === 0) return null;

            return (
              <section key={position} className="space-y-3">
                <div>
                  {/* Sentence case, and the label is rendered as authored:
                      an uppercase transform would turn "Header" into shouting
                      and force the wider tracking that goes with it. */}
                  <h3 className="text-sm font-semibold">
                    {POSITION_LABEL[position]}
                  </h3>
                  <p className="mt-1 text-xs text-content-muted">
                    {POSITION_HINT[position]}
                  </p>
                </div>

                <div className="divide-y divide-line rounded-md border border-line">
                  {group.map((script, index) => (
                    <ScriptRow
                      key={script.id}
                      script={script}
                      index={index}
                      total={group.length}
                      canManage={canManage}
                      disabled={isBusy}
                      onMove={(direction) =>
                        handleMove(position, index, direction)
                      }
                      // The only write without a field to render into, so
                      // this one keeps a toast - passed per call now that the
                      // hook itself no longer toasts.
                      onToggle={() =>
                        update.mutate(
                          {
                            id: script.id,
                            payload: { isActive: !script.isActive },
                          },
                          {
                            onError: (err: Error) =>
                              toast.error(
                                err.message || 'Could not change that script',
                              ),
                          },
                        )
                      }
                      onEdit={() => setEditing(script)}
                      onDelete={() => setPendingDelete(script)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </CardContent>

      <ScriptDialog
        open={adding || Boolean(editing)}
        script={editing}
        isSaving={create.isPending || update.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        // mutateAsync, and the rejection is deliberately NOT caught here: the
        // dialog catches it and renders it against the Code field, which is the
        // only place the message is actionable.
        onSave={async (draft) => {
          const payload = {
            name: draft.name.trim(),
            description: draft.description.trim(),
            position: draft.position,
            code: draft.code,
            isActive: draft.isActive,
          };
          if (editing) {
            await update.mutateAsync({ id: editing.id, payload });
          } else {
            await create.mutateAsync(payload);
          }
          setAdding(false);
          setEditing(null);
        }}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{pendingDelete?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The code is gone for good - you would have to fetch it from the
              vendor again. To take it off the site while keeping it, switch it
              off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ScriptRow({
  script,
  index,
  total,
  canManage,
  disabled,
  onMove,
  onToggle,
  onEdit,
  onDelete,
}: {
  script: CustomScript;
  index: number;
  total: number;
  canManage: boolean;
  disabled: boolean;
  onMove: (direction: 'up' | 'down') => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${
        script.isActive ? '' : 'opacity-60'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{script.name}</span>
          <StatusBadge variant={script.isActive ? 'success' : 'neutral'}>
            {script.isActive ? 'Live' : 'Off'}
          </StatusBadge>
        </div>
        {script.description && (
          <p className="mt-0.5 truncate text-xs text-content-muted">
            {script.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onMove('up')}
          disabled={!canManage || disabled || index === 0}
          title="Run earlier"
        >
          <HugeiconsIcon icon={ArrowUp02Icon} className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onMove('down')}
          disabled={!canManage || disabled || index === total - 1}
          title="Run later"
        >
          <HugeiconsIcon icon={ArrowDown02Icon} className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onEdit}
          disabled={disabled}
          title="Edit"
        >
          <HugeiconsIcon icon={PencilEdit02Icon} className="size-3.5" />
        </Button>
        {canManage && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggle}
              disabled={disabled}
            >
              {script.isActive ? 'Turn off' : 'Turn on'}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onDelete}
              disabled={disabled}
              title="Delete"
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ScriptDialog({
  open,
  script,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  script: CustomScript | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  /** Must REJECT on failure - the rejection is what this dialog renders. */
  onSave: (draft: ScriptDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ScriptDraft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setDraft(
      script
        ? {
            name: script.name,
            description: script.description ?? '',
            position: script.position,
            code: script.code,
            isActive: script.isActive,
          }
        : EMPTY_DRAFT,
    );
  }, [open, script]);

  const set = <K extends keyof ScriptDraft>(key: K, value: ScriptDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSave = draft.name.trim().length > 0 && draft.code.trim().length > 0;

  /**
   * The server owns validation, so this is where its verdict arrives.
   *
   * The message is the useful part - "<base> is not allowed", "<script> is never
   * closed", "not valid JavaScript: Unexpected token ':'" - so it is rendered
   * against the Code field rather than thrown at a toast that fades before the
   * admin has finished reading 40 lines of pasted vendor code.
   */
  async function handleSave() {
    setSaveError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setSaveError(
        err instanceof Error && err.message
          ? err.message
          : 'Could not save this script.',
      );
      // The editor is tall enough to push the message out of view when the
      // admin has scrolled up inside the dialog.
      requestAnimationFrame(() =>
        errorRef.current?.scrollIntoView({ block: 'nearest' }),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Sized to the viewport, not to a breakpoint.

        - Width `min(96vw, 1100px)`: fluid on a phone, capped so the code never
          stretches into an unreadable line length on an ultrawide. `sm:max-w-none`
          is required to defeat DialogContent's own `sm:max-w-md`.
        - `max-h-[92dvh]` + explicit grid rows: the header and footer are fixed
          and the MIDDLE row scrolls. `dvh` rather than `vh` so a mobile browser's
          collapsing address bar cannot push Save off the bottom.
        - `minmax(0,1fr)` on that middle row: without the 0 minimum a grid track
          refuses to shrink below its content and the overflow never engages.
      */}
      <DialogContent className="grid max-h-[92dvh] w-[min(96vw,1100px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{script ? 'Edit script' : 'Add script'}</DialogTitle>
          <DialogDescription>
            Paste the vendor&apos;s snippet exactly as they give it to you.
          </DialogDescription>
        </DialogHeader>

        {/* `hide-scrollbar`: this area still scrolls, the bar is just not
            painted. With the app's 7px teal thumb it sat a few pixels from
            CodeMirror's own bar, reading as two rails inside one dialog. */}
        <div className="hide-scrollbar min-h-0 space-y-4 overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="cs-name">Name</Label>
              <Input
                id="cs-name"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Hotjar"
              />
              <FieldDescription>
                So the next person knows what this is.
              </FieldDescription>
            </Field>

            <Field>
              <Label>Position</Label>
              <Select
                value={draft.position}
                onValueChange={(v) =>
                  set('position', v as CustomScriptPosition)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                {/* Document order, matching the two sections in the list
                    behind this dialog. Footer stays the DEFAULT even though it
                    is listed second - the hint below carries that. */}
                <SelectContent>
                  <SelectItem value="HEAD">{POSITION_LABEL.HEAD}</SelectItem>
                  <SelectItem value="BODY_END">
                    {POSITION_LABEL.BODY_END}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                {POSITION_HINT[draft.position]}
              </FieldDescription>
            </Field>
          </div>

          <Field>
            <Label htmlFor="cs-description">Note (optional)</Label>
            <Input
              id="cs-description"
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Owned by marketing; review in Q1."
            />
          </Field>

          <ScriptEditor
            label="Code"
            value={draft.code}
            onChange={(code) => {
              set('code', code);
              // The message describes the code as it WAS. Keeping it on screen
              // while the admin fixes the very line it names reads as "still
              // broken" long after it is not.
              if (saveError) setSaveError(null);
            }}
            invalid={Boolean(saveError)}
            description="<script>, <style>, <link>, <meta> and <noscript> only. The server checks the structure and will say exactly what it rejected."
          />

          {/* Directly under the Code field: the server's verdict is almost
              always about this snippet, and it has to sit next to it to be
              actionable. Same component as the trip wizard's step error. */}
          <div ref={errorRef}>
            <SaveError
              message={saveError}
              title="This script could not be saved"
              onDismiss={() => setSaveError(null)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-active"
              checked={draft.isActive}
              onCheckedChange={(c) => set('isActive', c === true)}
            />
            <Label htmlFor="cs-active" className="cursor-pointer font-normal">
              Live on the site
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
