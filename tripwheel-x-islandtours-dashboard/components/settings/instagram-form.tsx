'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
    Alert02Icon,
    ArrowDown02Icon,
    ArrowUp02Icon,
    Cancel01Icon,
    Image02Icon,
    PencilEdit02Icon,
    PlayIcon,
    RefreshIcon,
    ViewIcon,
    ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { Badge } from '@/components/ui/badge';
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
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import {
    useDeleteInstagramPost,
    useInstagramAccount,
    useInstagramConnection,
    useInstagramCredentials,
    useInstagramPosts,
    useReorderInstagramPosts,
    useSaveInstagramCredentials,
    useSyncInstagram,
    useUpdateInstagramAccount,
    useUpdateInstagramPost,
} from '@/hooks/instagram/use-instagram';
import { useSiteInfo, useUpdateSiteInfo } from '@/hooks/settings/use-settings';
import type {
    InstagramConnection,
    InstagramLayout,
    InstagramPost,
} from '@/types/instagram';
import {
    SecretField,
    SettingsCard,
    SettingsCardSkeleton,
    TextField,
} from './settings-fields';

/** Brand-wide tiles carry no destination; Select needs a non-empty value. */
const BRAND_WIDE = 'brand-wide';

/**
 * How many live tiles each layout wants before the section looks finished: the
 * curated grid is 2 x 3; the gallery is three rows of five (and five rows of
 * three on a phone), so 15 is what fills its last row at both widths. Mirrors
 * DEFAULT_LIMIT_BY_LAYOUT in the backend's instagram.service.ts.
 */
const SLOTS_BY_LAYOUT: Record<InstagramLayout, number> = {
    GRID: 6,
    GALLERY: 15,
};

// ── Instagram settings (token + connection + section, one card) ─────────────--

const instagramSettingsSchema = z.object({
    accessToken: z.string().optional(),
    enabled: z.boolean(),
    layout: z.enum(['GRID', 'GALLERY']),
    // Kept in range at the input (setValueAs clamps 1..50) and the select (fixed
    // options), so the schema only needs to know they are numbers - no coerce, so
    // the form's input/output types stay aligned for the RHF resolver.
    syncFetchLimit: z.number(),
    syncIntervalMinutes: z.number(),
});
type InstagramSettingsValues = z.infer<typeof instagramSettingsSchema>;

/** Round + clamp a number input to the allowed posts-per-sync range (1..50). */
function clampFetchLimit(raw: unknown): number {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return 24;
    return Math.min(50, Math.max(1, n));
}

/** Auto-sync cadences, in minutes, offered in the frequency select. */
const SYNC_FREQUENCIES: { value: number; label: string }[] = [
    { value: 180, label: 'Every 3 hours' },
    { value: 360, label: 'Every 6 hours' },
    { value: 720, label: 'Every 12 hours' },
    { value: 1440, label: 'Daily' },
];

/** The last-sync status, coloured by how much attention it needs. */
function SyncStatusBadge({ connection }: { connection: InstagramConnection }) {
    const { lastSyncStatus, lastSyncedAt } = connection;
    if (!lastSyncedAt || !lastSyncStatus) return null;

    const variant =
        lastSyncStatus === 'OK'
            ? 'success'
            : lastSyncStatus === 'PARTIAL'
              ? 'warning'
              : 'danger';
    const label =
        lastSyncStatus === 'OK'
            ? 'Synced'
            : lastSyncStatus === 'PARTIAL'
              ? 'Synced with warnings'
              : lastSyncStatus === 'EXPIRING'
                ? 'Token expiring'
                : 'Sync failed';

    return <StatusBadge variant={variant}>{label}</StatusBadge>;
}

/**
 * The whole integration in one compact card: the access token that connects the
 * account, the live connection status + manual sync, the sync tuning (how many
 * posts, how often), and the section controls (on/off, auto handle, layout).
 * Tiles are curated in their own card below.
 *
 * There is no OAuth, App ID/Secret or Redirect - a long-lived access token is
 * the entire credential (write-only; the field shows a "stored" hint and is only
 * sent when re-typed). Saving a new token re-seeds the connection. Save Changes
 * persists everything at once; Sync now is a separate action.
 */
function InstagramSettingsCard() {
    const { data: cred, isLoading: credLoading } = useInstagramCredentials();
    const { data: connection } = useInstagramConnection();
    const { data: account, isLoading: accountLoading } = useInstagramAccount();
    const { data: siteInfo, isLoading: siteLoading } = useSiteInfo();

    // mutateAsync, not mutate: Save Changes writes up to three endpoints and they
    // have to run in sequence so a failure can stop the chain and re-sync the form
    // (see onSubmit). Fired in parallel they left half-saved state on screen.
    const { mutateAsync: saveToken, isPending: savingToken } =
        useSaveInstagramCredentials();
    const { mutateAsync: saveAccount, isPending: savingAccount } =
        useUpdateInstagramAccount();
    const { mutateAsync: saveSiteInfo, isPending: savingSite } =
        useUpdateSiteInfo();
    const sync = useSyncInstagram();

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { dirtyFields, errors },
    } = useForm<InstagramSettingsValues>({
        resolver: zodResolver(instagramSettingsSchema),
        defaultValues: {
            accessToken: '',
            enabled: true,
            layout: 'GALLERY',
            syncFetchLimit: 24,
            syncIntervalMinutes: 1440,
        },
    });

    useEffect(() => {
        if (cred && account && siteInfo) {
            // The token is write-only, so its field always resets blank. Defaults
            // (when a value is absent) are section-on + the gallery layout.
            reset({
                accessToken: '',
                enabled: siteInfo.enableInstagram,
                layout: account.layout ?? 'GALLERY',
                syncFetchLimit: account.syncFetchLimit ?? 24,
                syncIntervalMinutes: account.syncIntervalMinutes ?? 1440,
            });
        }
        // Deps are query-data REFERENCES, and TanStack's structural sharing keeps
        // the previous reference when a refetch returns deep-equal JSON. So this
        // effect deliberately CANNOT be relied on to re-baseline the form after a
        // save that changed nothing observable (re-saving the same token is exactly
        // that) - onSubmit calls reset() itself for that reason.
    }, [cred, account, siteInfo, reset]);

    if (
        credLoading ||
        accountLoading ||
        siteLoading ||
        !cred ||
        !account ||
        !siteInfo
    ) {
        return <SettingsCardSkeleton />;
    }

    // The handle is auto-derived from the connected account, shown read-only.
    const handle = account.username?.trim() || null;
    const enabled = watch('enabled') ?? true;
    // Coerce each Select's value to a VALID option so the trigger can never render
    // empty (a stale value, a first paint before reset, undefined/NaN): a value
    // that is not one of the known options falls back to the default.
    const rawLayout = watch('layout');
    const layout: InstagramLayout =
        rawLayout === 'GRID' || rawLayout === 'GALLERY' ? rawLayout : 'GALLERY';
    const rawFrequency = watch('syncIntervalMinutes');
    const frequency = SYNC_FREQUENCIES.some(f => f.value === rawFrequency)
        ? (rawFrequency as number)
        : 1440;
    const connected = connection?.connected ?? false;

    /**
     * One button, three endpoints (token / account / kill switch), run IN SEQUENCE
     * and always followed by a reset to server truth.
     *
     * Both halves of that matter:
     *
     * - Sequenced + stop-on-failure. Fired in parallel, one rejected PATCH left
     *   the other two applied and no way to tell which had landed.
     * - Always reset(), success or failure. Nothing else reliably re-baselines
     *   this form: the effect above keys off query-data references, and TanStack's
     *   structural sharing hands back the SAME reference when a refetch is
     *   deep-equal - so after saving a token while one was already stored, the
     *   effect never ran, the field kept its text and stayed dirty, and every
     *   later save re-sent the token. The backend reads a token write as a
     *   reconnect, so changing the layout would silently drop igUserId, the
     *   refreshed token, the expiry and the last-sync stamp.
     *   The same reset is what stops a REJECTED field from sitting on screen
     *   looking saved.
     *
     * `next*` tracks server truth as each write lands, so a failure halfway
     * through re-syncs the fields that did save and reverts the ones that did not.
     */
    async function onSubmit(values: InstagramSettingsValues) {
        let nextLayout: InstagramLayout = account?.layout ?? 'GALLERY';
        let nextFetchLimit = account?.syncFetchLimit ?? 24;
        let nextInterval = account?.syncIntervalMinutes ?? 1440;
        let nextEnabled = siteInfo?.enableInstagram ?? true;

        try {
            // The token goes out only when its field was actually edited. It is
            // write-only, so there is nothing to diff it against here - the backend
            // no-ops a re-submit of the value it already holds rather than treating it
            // as a reconnect.
            if (dirtyFields.accessToken) {
                await saveToken({
                    accessToken: (values.accessToken ?? '').trim(),
                });
            }

            const accountPatch: {
                layout?: InstagramLayout;
                syncFetchLimit?: number;
                syncIntervalMinutes?: number;
            } = {};
            if (values.layout !== nextLayout)
                accountPatch.layout = values.layout;
            if (values.syncFetchLimit !== nextFetchLimit) {
                accountPatch.syncFetchLimit = values.syncFetchLimit;
            }
            if (values.syncIntervalMinutes !== nextInterval) {
                accountPatch.syncIntervalMinutes = values.syncIntervalMinutes;
            }
            if (Object.keys(accountPatch).length > 0) {
                const saved = await saveAccount(accountPatch);
                nextLayout = saved.layout ?? nextLayout;
                nextFetchLimit = saved.syncFetchLimit ?? nextFetchLimit;
                nextInterval = saved.syncIntervalMinutes ?? nextInterval;
            }

            if (values.enabled !== nextEnabled) {
                const saved = await saveSiteInfo({
                    enableInstagram: values.enabled,
                });
                nextEnabled = saved.enableInstagram;
            }
        } catch {
            // Each mutation hook already toasts the reason; what this handler owes the
            // user is the re-sync below, so the form stops showing anything the server
            // did not accept.
        } finally {
            reset({
                accessToken: '',
                enabled: nextEnabled,
                layout: nextLayout,
                syncFetchLimit: nextFetchLimit,
                syncIntervalMinutes: nextInterval,
            });
        }
    }

    return (
        <SettingsCard
            title='Instagram'
            description='Sync tiles from your Instagram account and control how the section renders.'
            // The second callback is not optional here: handleSubmit silently skips
            // onSubmit when the resolver rejects, so without it a validation failure
            // made Save Changes do nothing at all - no toast, no message, no write.
            onSubmit={handleSubmit(onSubmit, invalid => {
                const first = Object.values(invalid).find(
                    e => e?.message
                )?.message;
                toast.error(
                    first ?? 'Some fields need fixing before this can save.'
                );
            })}
            isSaving={savingToken || savingAccount || savingSite}
            status={
                connected ? (
                    <StatusBadge variant='success'>Connected</StatusBadge>
                ) : (
                    <StatusBadge variant='neutral'>No token</StatusBadge>
                )
            }>
            <div className='space-y-6'>
                {/* Status strip: connection health + on-demand sync, full width. */}
                <div className='flex max-w-2xl flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg bg-surface px-4 py-3 text-sm'>
                    {connected ? (
                        <div className='flex flex-wrap items-center gap-x-8 gap-y-1.5'>
                            <span className='flex items-center gap-2'>
                                <span className='text-content-muted'>
                                    Last sync
                                </span>
                                <span className='font-medium'>
                                    {formatWhen(
                                        connection?.lastSyncedAt ?? null
                                    ) ?? 'Never'}
                                </span>
                                {connection && (
                                    <SyncStatusBadge connection={connection} />
                                )}
                            </span>
                            <span className='flex items-center gap-2'>
                                <span className='text-content-muted'>
                                    Token expires
                                </span>
                                <span className='font-medium'>
                                    {formatWhen(
                                        connection?.tokenExpiresAt ?? null
                                    ) ?? 'Unknown'}
                                </span>
                            </span>
                        </div>
                    ) : (
                        <span className='flex items-center gap-2 text-content-muted'>
                            <HugeiconsIcon
                                icon={Alert02Icon}
                                className='size-4 shrink-0'
                            />
                            No token yet - paste one below and run a sync to
                            connect.
                        </span>
                    )}

                    {/* type="button" so it never submits the surrounding settings form. */}
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => sync.mutate()}
                        disabled={sync.isPending || !connected}>
                        <HugeiconsIcon
                            icon={RefreshIcon}
                            className='size-3.5'
                        />
                        {sync.isPending ? 'Syncing...' : 'Sync now'}
                    </Button>
                </div>

                {connected && connection?.lastSyncError && (
                    <p className='-mt-3 text-xs text-danger-fg'>
                        {connection.lastSyncError}
                    </p>
                )}

                {/* Even two-column field grid. */}
                <div className='grid gap-x-6 gap-y-4 sm:grid-cols-2'>
                    {/* autoComplete="off", not "new-password": this is an API credential,
              and a "new-password" field invites the browser's password UI to
              write into it. Anything a manager fills here counts as a user edit,
              which would send it as the Instagram token on the next save. */}
                    <SecretField
                        label='Access Token'
                        registration={register('accessToken')}
                        placeholder='IGAA...'
                        error={errors.accessToken?.message}
                        description={
                            cred.maskedAccessToken
                                ? `Current: ${cred.maskedAccessToken}. Leave blank to keep it.`
                                : cred.hasAccessToken
                                  ? // Stored but unreadable - the encryption key changed under it.
                                    'Stored value cannot be decrypted. Paste the token again to fix it.'
                                  : 'Long-lived token; stored encrypted and auto-refreshed.'
                        }
                    />

                    <TextField
                        label='Posts per sync'
                        type='number'
                        registration={register('syncFetchLimit', {
                            setValueAs: clampFetchLimit,
                        })}
                        placeholder='24'
                        error={errors.syncFetchLimit?.message}
                        description='Recent posts pulled each sync (1-50).'
                    />

                    <Field>
                        <Label>Sync frequency</Label>
                        <Select
                            value={String(frequency)}
                            onValueChange={v =>
                                setValue('syncIntervalMinutes', Number(v), {
                                    shouldDirty: true,
                                })
                            }>
                            <SelectTrigger className='w-full'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SYNC_FREQUENCIES.map(f => (
                                    <SelectItem
                                        key={f.value}
                                        value={String(f.value)}>
                                        {f.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldDescription>
                            How often tiles auto-sync.
                        </FieldDescription>
                    </Field>

                    <Field>
                        <Label>Layout</Label>
                        <Select
                            value={layout}
                            onValueChange={v =>
                                setValue('layout', v as InstagramLayout, {
                                    shouldDirty: true,
                                })
                            }>
                            <SelectTrigger className='w-full'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='GRID'>
                                    Curated grid
                                </SelectItem>
                                <SelectItem value='GALLERY'>
                                    Instagram gallery
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <FieldDescription>
                            How the public grid is drawn.
                        </FieldDescription>
                    </Field>

                    <Field>
                        <Label>Handle</Label>
                        <div className='flex h-9 items-center overflow-hidden rounded-md border border-line bg-surface-inset px-3 text-sm'>
                            {handle ? (
                                <span className='truncate font-medium'>
                                    @{handle}
                                </span>
                            ) : (
                                <span className='text-content-muted'>
                                    Resolved on the first sync
                                </span>
                            )}
                        </div>
                        <FieldDescription>
                            Auto-filled from the account.
                        </FieldDescription>
                    </Field>

                    <Field>
                        <Label>Visibility</Label>
                        <div className='flex h-9 items-center gap-2'>
                            <Checkbox
                                id='enableInstagram'
                                checked={enabled}
                                onCheckedChange={c =>
                                    setValue('enabled', c === true, {
                                        shouldDirty: true,
                                    })
                                }
                            />
                            <Label
                                htmlFor='enableInstagram'
                                className='cursor-pointer font-light'>
                                Show the Instagram section
                            </Label>
                        </div>
                        <FieldDescription>
                            Off hides it on every destination page.
                        </FieldDescription>
                    </Field>
                </div>

                {enabled && !handle && (
                    <p className='flex items-start gap-2 text-xs text-danger-fg'>
                        <HugeiconsIcon
                            icon={Alert02Icon}
                            className='mt-px size-3.5 shrink-0'
                        />
                        Without a handle the whole section stays hidden - it is
                        the heading it is built around.
                    </p>
                )}
            </div>
        </SettingsCard>
    );
}

// ── Tiles (curation only: reorder, hide, alt/island) ───────────────────────--

interface TileDraft {
    altText: string;
    destinationId: string;
}

/**
 * The synced grid. Tiles come only from the sync now, so there is no add
 * button - the curation left is ordering, hiding, and per-tile alt text /
 * island. The first N (by layout) render on the public page; the rest sit here
 * greyed out.
 */
function TilesCard() {
    const { data: posts = [], isLoading } = useInstagramPosts();
    const { data: account } = useInstagramAccount();
    const { data: destinations = [] } = useActiveDestinations();
    const update = useUpdateInstagramPost();
    const reorder = useReorderInstagramPosts();
    const remove = useDeleteInstagramPost();

    const [editing, setEditing] = useState<InstagramPost | null>(null);
    const [pendingDelete, setPendingDelete] = useState<InstagramPost | null>(
        null
    );

    // This sorted view IS the public order; the arrows act on it.
    const ordered = [...posts].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id)
    );
    const slots = SLOTS_BY_LAYOUT[account?.layout ?? 'GRID'];
    const isBusy = update.isPending || reorder.isPending;

    function handleMove(index: number, direction: 'up' | 'down') {
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= ordered.length) return;
        const next = [...ordered];
        [next[index], next[target]] = [next[target], next[index]];
        reorder.mutate({
            items: next.map((p, i) => ({ id: p.id, displayOrder: i })),
        });
    }

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                        <div className='flex flex-wrap items-center gap-3'>
                            <CardTitle className='text-lg font-medium'>
                                Feed Tiles
                            </CardTitle>
                            {!isLoading && ordered.length > 0 && (
                                <Badge variant='secondary'>
                                    {ordered.length} tile
                                    {ordered.length === 1 ? '' : 's'}
                                </Badge>
                            )}
                        </div>
                        <CardDescription className='mt-1'>
                            Mirrored from the connected account. The first{' '}
                            {slots} reach the page - that is the cap for the{' '}
                            {account?.layout === 'GALLERY' ? 'gallery' : 'grid'}{' '}
                            layout (grid {SLOTS_BY_LAYOUT.GRID}, gallery{' '}
                            {SLOTS_BY_LAYOUT.GALLERY}). Reorder to choose which;
                            hide any you would rather not show.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className='space-y-6'>
                {isLoading ? (
                    <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton
                                key={i}
                                className='aspect-384/337 w-full rounded-md'
                            />
                        ))}
                    </div>
                ) : ordered.length === 0 ? (
                    <div className='flex flex-col items-center gap-2 rounded-md border border-dashed border-line py-16 text-content-muted'>
                        <HugeiconsIcon
                            icon={Image02Icon}
                            className='size-10 opacity-30'
                        />
                        <p className='text-sm'>
                            No tiles yet - connect the account above and run a
                            sync.
                        </p>
                    </div>
                ) : (
                    <>
                        {ordered.length < slots && (
                            <p className='rounded-md bg-surface-inset p-3 text-xs text-content-muted'>
                                {ordered.length} of {slots} slots filled - the
                                section renders short until the sync brings in{' '}
                                {slots}.
                            </p>
                        )}

                        {ordered.length > slots && (
                            <p className='rounded-md bg-surface-inset p-3 text-xs text-content-muted'>
                                {ordered.length} tiles, but the{' '}
                                {account?.layout === 'GALLERY'
                                    ? 'gallery'
                                    : 'grid'}{' '}
                                layout draws only the first {slots}. The
                                greyed-out tiles from #{slots + 1} down stay
                                saved here - move one up to put it on the page.
                            </p>
                        )}

                        <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
                            {ordered.map((post, index) => (
                                <TileCard
                                    key={post.id}
                                    post={post}
                                    index={index}
                                    total={ordered.length}
                                    cappedOut={index >= slots}
                                    disabled={isBusy}
                                    onMove={handleMove}
                                    onToggleHidden={() =>
                                        update.mutate({
                                            id: post.id,
                                            payload: {
                                                isActive: !post.isActive,
                                            },
                                        })
                                    }
                                    onEdit={() => setEditing(post)}
                                    onDelete={() => setPendingDelete(post)}
                                />
                            ))}
                        </div>
                    </>
                )}
            </CardContent>

            <TileDialog
                open={Boolean(editing)}
                post={editing}
                destinations={destinations}
                isSaving={update.isPending}
                onOpenChange={open => !open && setEditing(null)}
                onSave={draft => {
                    if (!editing) return;
                    update.mutate(
                        {
                            id: editing.id,
                            payload: {
                                altText: draft.altText,
                                destinationId:
                                    draft.destinationId === BRAND_WIDE
                                        ? null
                                        : draft.destinationId,
                            },
                        },
                        { onSuccess: () => setEditing(null) }
                    );
                }}
            />

            <AlertDialog
                open={Boolean(pendingDelete)}
                onOpenChange={open => !open && setPendingDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this tile?</AlertDialogTitle>
                        <AlertDialogDescription>
                            It disappears from the destination pages. The next
                            sync will bring it back if the post is still among
                            the recent ones - hide it instead to keep it out for
                            good.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingDelete)
                                    remove.mutate(pendingDelete.id);
                                setPendingDelete(null);
                            }}>
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

function TileCard({
    post,
    index,
    total,
    cappedOut,
    disabled,
    onMove,
    onToggleHidden,
    onEdit,
    onDelete,
}: {
    post: InstagramPost;
    index: number;
    total: number;
    /** Past the layout's cap: saved, but never drawn on the public page. */
    cappedOut: boolean;
    disabled: boolean;
    onMove: (index: number, direction: 'up' | 'down') => void;
    onToggleHidden: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const hidden = !post.isActive;
    // "Off the page" for either reason: the admin hid it, or it fell past the cap.
    const dimmed = hidden || cappedOut;

    return (
        <div
            className={`group overflow-hidden rounded-md border ${dimmed ? 'border-dashed border-line opacity-60' : 'border-line'}`}>
            <div className='relative aspect-384/337 bg-surface-inset'>
                {/* The poster, matching what the public grid paints first. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={post.imageUrl}
                    alt=''
                    className='size-full object-cover'
                />

                <button
                    type='button'
                    onClick={onEdit}
                    disabled={disabled}
                    title='Edit alt text / island'
                    className='absolute inset-0 flex items-center justify-center transition-colors hover:bg-n-1000/40 disabled:cursor-not-allowed'>
                    <HugeiconsIcon
                        icon={PencilEdit02Icon}
                        className='size-5 text-n-0 opacity-0 transition-opacity group-hover:opacity-100'
                    />
                    <span className='sr-only'>Edit tile</span>
                </button>

                {/* The number IS the position in the public grid. It carries the reason
            a tile is greyed out, so the state is legible without counting. */}
                <span className='pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-n-1000/70 px-2 py-0.5 text-2xs font-medium text-n-0 tabular-nums'>
                    {index + 1}
                    {hidden ? (
                        <span className='font-light'>· hidden</span>
                    ) : cappedOut ? (
                        <span className='font-light'>· not shown</span>
                    ) : null}
                </span>

                {post.videoUrl && (
                    <span className='pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-n-1000/70 px-2 py-0.5 text-2xs font-medium text-n-0'>
                        <HugeiconsIcon icon={PlayIcon} className='size-3' />
                        Video
                    </span>
                )}

                {/* Corner actions: hide/show + remove, always visible like every other
            media control in this dashboard. */}
                <div className='absolute right-1.5 top-1.5 z-10 flex gap-1'>
                    <button
                        type='button'
                        onClick={onToggleHidden}
                        disabled={disabled}
                        title={
                            hidden ? 'Show on the site' : 'Hide from the site'
                        }
                        className='flex size-5 items-center justify-center bg-black/60 text-white transition-colors hover:bg-black/80 disabled:opacity-50'>
                        <HugeiconsIcon
                            icon={hidden ? ViewOffIcon : ViewIcon}
                            className='size-3'
                        />
                        <span className='sr-only'>
                            {hidden ? 'Show tile' : 'Hide tile'}
                        </span>
                    </button>
                    <button
                        type='button'
                        onClick={onDelete}
                        title='Remove tile'
                        className='flex size-5 items-center justify-center bg-black/60 text-white transition-colors hover:bg-destructive'>
                        <HugeiconsIcon icon={Cancel01Icon} className='size-3' />
                        <span className='sr-only'>Remove tile</span>
                    </button>
                </div>

                <div className='absolute bottom-2 left-2 z-10 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'>
                    <Button
                        size='icon-sm'
                        variant='secondary'
                        onClick={() => onMove(index, 'up')}
                        disabled={disabled || index === 0}
                        title='Move earlier'>
                        <HugeiconsIcon
                            icon={ArrowUp02Icon}
                            className='size-3'
                        />
                    </Button>
                    <Button
                        size='icon-sm'
                        variant='secondary'
                        onClick={() => onMove(index, 'down')}
                        disabled={disabled || index === total - 1}
                        title='Move later'>
                        <HugeiconsIcon
                            icon={ArrowDown02Icon}
                            className='size-3'
                        />
                    </Button>
                </div>
            </div>

            <div className='space-y-1.5 p-3'>
                <p className='truncate text-sm'>
                    {post.caption || (
                        <span className='text-content-muted'>No caption</span>
                    )}
                </p>
                <div className='flex flex-wrap items-center gap-1.5'>
                    <StatusBadge variant='neutral'>
                        {post.destinationName ?? 'All islands'}
                    </StatusBadge>
                    {!post.permalink && (
                        <StatusBadge variant='neutral'>
                            Links to profile
                        </StatusBadge>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * The only per-tile edit left: alt text and which island it shows on. The media,
 * caption and link belong to the sync (a re-run reverts any edit), so they are
 * read-only here - shown for context, not editable.
 */
function TileDialog({
    open,
    post,
    destinations,
    isSaving,
    onOpenChange,
    onSave,
}: {
    open: boolean;
    post?: InstagramPost | null;
    destinations: { id: string; name: string }[];
    isSaving: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (draft: TileDraft) => void;
}) {
    const [draft, setDraft] = useState<TileDraft>({
        altText: '',
        destinationId: BRAND_WIDE,
    });

    useEffect(() => {
        if (!open || !post) return;
        setDraft({
            altText: post.altText ?? '',
            destinationId: post.destinationId ?? BRAND_WIDE,
        });
    }, [open, post]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>Curate tile</DialogTitle>
                    <DialogDescription>
                        The photo, caption and link come from Instagram and
                        refresh on every sync. What you set here sticks.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-4'>
                    {post?.caption && (
                        <p className='rounded-md bg-surface-inset p-3 text-xs text-content-muted'>
                            {post.caption}
                        </p>
                    )}

                    <Field>
                        <Label htmlFor='ig-alt'>Alt text</Label>
                        <Input
                            id='ig-alt'
                            value={draft.altText}
                            onChange={e =>
                                setDraft(d => ({
                                    ...d,
                                    altText: e.target.value,
                                }))
                            }
                            placeholder='Catamaran at sunset off Willemstad'
                        />
                        <FieldDescription>
                            Overrides the caption for screen readers (hashtags
                            and mentions make poor alt text).
                        </FieldDescription>
                    </Field>

                    <Field>
                        <Label>Show on</Label>
                        <Select
                            value={draft.destinationId}
                            onValueChange={v =>
                                setDraft(d => ({ ...d, destinationId: v }))
                            }>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={BRAND_WIDE}>
                                    All islands
                                </SelectItem>
                                {destinations.map(d => (
                                    <SelectItem key={d.id} value={d.id}>
                                        {d.name} only
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                </div>

                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={() => onSave(draft)} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** now-relative-ish absolute stamp, e.g. "Jul 28, 2026, 3:00 AM". */
function formatWhen(iso: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

/**
 * Settings &gt; Instagram. The public grid renders from these rows on every
 * destination page - no third-party embed, so it is server-rendered with the
 * rest of the page and carries no extra cookies. Tiles are mirrored from the
 * connected account by the sync; the dashboard only connects it and curates.
 */
export function InstagramForm() {
    return (
        <div className='space-y-6'>
            <InstagramSettingsCard />
            <TilesCard />
        </div>
    );
}

