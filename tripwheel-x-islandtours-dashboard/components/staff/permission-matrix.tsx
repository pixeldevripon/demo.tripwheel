'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { PermissionKey } from '@/lib/config/rbac';
import { cn } from '@/lib/utils';
import type { PermissionCatalogGroup } from '@/types/staff';
import { useMemo } from 'react';

interface PermissionMatrixProps {
    /** Grouped catalog from GET /staff/permission-catalog (ceiling applied). */
    groups: PermissionCatalogGroup[];
    /** Currently selected permission keys. */
    value: PermissionKey[];
    onChange: (next: PermissionKey[]) => void;
    /**
     * Keys rendered checked + locked (the non-revocable base floor). They are
     * NOT part of `value` - the backend grants them implicitly.
     */
    lockedKeys?: PermissionKey[];
    disabled?: boolean;
}

/**
 * The grouped permission-matrix editor shared by the designation form and the
 * per-member override editor. Each group header carries a tri-state select-all;
 * locked (base-floor) permissions render checked and immutable so the picture
 * always matches what the backend will actually enforce.
 */
export function PermissionMatrix({
    groups,
    value,
    onChange,
    lockedKeys = [],
    disabled = false,
}: PermissionMatrixProps) {
    const selected = useMemo(() => new Set(value), [value]);
    const locked = useMemo(() => new Set(lockedKeys), [lockedKeys]);

    function toggle(key: PermissionKey, checked: boolean) {
        const next = new Set(selected);
        if (checked) next.add(key);
        else next.delete(key);
        onChange([...next]);
    }

    function toggleGroup(group: PermissionCatalogGroup, checked: boolean) {
        const next = new Set(selected);
        for (const p of group.permissions) {
            if (locked.has(p.key)) continue;
            if (checked) next.add(p.key);
            else next.delete(p.key);
        }
        onChange([...next]);
    }

    return (
        <div className='space-y-4'>
            {groups.map(group => {
                const togglable = group.permissions.filter(
                    p => !locked.has(p.key)
                );
                const checkedCount = togglable.filter(p =>
                    selected.has(p.key)
                ).length;
                const groupState: boolean | 'indeterminate' =
                    togglable.length > 0 && checkedCount === togglable.length
                        ? true
                        : checkedCount > 0
                          ? 'indeterminate'
                          : false;

                return (
                    <div
                        key={group.group}
                        className='rounded-lg border border-line bg-surface-raised'>
                        <label
                            className={cn(
                                'flex items-center gap-2.5 border-b border-line px-4 py-2.5',
                                !disabled && 'cursor-pointer'
                            )}>
                            <Checkbox
                                checked={groupState}
                                disabled={disabled || togglable.length === 0}
                                onCheckedChange={v =>
                                    toggleGroup(group, v === true)
                                }
                            />
                            <span className='text-sm font-medium'>
                                {group.group}
                            </span>
                            <span className='ml-auto text-xs text-muted-foreground'>
                                {checkedCount +
                                    group.permissions.filter(p =>
                                        locked.has(p.key)
                                    ).length}
                                /{group.permissions.length}
                            </span>
                        </label>
                        <div className='grid grid-cols-1 gap-x-4 gap-y-2.5 p-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3'>
                            {group.permissions.map(permission => {
                                const isLocked = locked.has(permission.key);
                                return (
                                    <Label
                                        key={permission.key}
                                        className={cn(
                                            'flex items-center gap-2 text-sm font-light',
                                            isLocked || disabled
                                                ? 'text-muted-foreground'
                                                : 'cursor-pointer'
                                        )}
                                        title={
                                            isLocked
                                                ? 'Always granted to active members'
                                                : permission.key
                                        }>
                                        <Checkbox
                                            checked={
                                                isLocked ||
                                                selected.has(permission.key)
                                            }
                                            disabled={isLocked || disabled}
                                            onCheckedChange={v =>
                                                toggle(
                                                    permission.key,
                                                    v === true
                                                )
                                            }
                                        />
                                        <span className='truncate'>
                                            {permission.label}
                                        </span>
                                    </Label>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

