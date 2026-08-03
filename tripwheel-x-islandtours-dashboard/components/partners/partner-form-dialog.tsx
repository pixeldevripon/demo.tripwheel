'use client';

import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOperators } from '@/hooks/operators/use-operators';
import {
    useCreatePartner,
    useUpdatePartner,
} from '@/hooks/partners/use-partners';
import { getOperatorDisplayName } from '@/types/operator';
import {
    PartnerCatalogScope,
    type PartnerAccount,
} from '@/types/partner';

/** Keep in step with the backend `generateSlug`. */
const toSlug = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

/**
 * Create or edit a distribution partner.
 *
 * Catalog scope is set at creation and never edited. Changing it later would silently
 * widen or narrow what every existing key under the account can see, which is not a form
 * field, it is a new commercial relationship - delete-and-recreate is the honest path.
 */
export function PartnerFormDialog({
    open,
    onOpenChange,
    partner,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    partner?: PartnerAccount;
}) {
    const isEdit = Boolean(partner);
    const create = useCreatePartner();
    const update = useUpdatePartner();
    const pending = create.isPending || update.isPending;

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [contactEmail, setContactEmail] = useState('');
    const [catalogScope, setCatalogScope] = useState<PartnerCatalogScope>(
        PartnerCatalogScope.SINGLE_OPERATOR,
    );
    const [operatorId, setOperatorId] = useState('');
    const [notes, setNotes] = useState('');

    // Only fetched for the picker, and only when the picker can be shown.
    const { data: operators } = useOperators({ limit: 100 });

    useEffect(() => {
        if (!open) return;
        setName(partner?.name ?? '');
        setSlug(partner?.slug ?? '');
        setSlugTouched(Boolean(partner));
        setContactEmail(partner?.contactEmail ?? '');
        setCatalogScope(
            partner?.catalogScope ?? PartnerCatalogScope.SINGLE_OPERATOR,
        );
        setOperatorId(partner?.operatorId ?? '');
        setNotes(partner?.notes ?? '');
    }, [open, partner]);

    const onNameChange = (value: string) => {
        setName(value);
        if (!slugTouched) setSlug(toSlug(value));
    };

    const needsOperator =
        catalogScope === PartnerCatalogScope.SINGLE_OPERATOR && !operatorId;

    const submit = () => {
        if (isEdit && partner) {
            update.mutate(
                {
                    id: partner.id,
                    payload: {
                        name,
                        contactEmail: contactEmail || undefined,
                        notes,
                    },
                },
                { onSuccess: () => onOpenChange(false) },
            );
            return;
        }

        create.mutate(
            {
                name,
                slug: slug || undefined,
                contactEmail: contactEmail || undefined,
                catalogScope,
                ...(catalogScope === PartnerCatalogScope.SINGLE_OPERATOR
                    ? { operatorId }
                    : {}),
                notes: notes || undefined,
            },
            { onSuccess: () => onOpenChange(false) },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Edit partner' : 'Add a distribution partner'}
                    </DialogTitle>
                    <DialogDescription>
                        A channel that sells our tours through their own
                        marketplace.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-4'>
                    <div className='space-y-2'>
                        <Label htmlFor='partner-name'>Name</Label>
                        <Input
                            id='partner-name'
                            value={name}
                            onChange={e => onNameChange(e.target.value)}
                            placeholder='GetYourGuide'
                        />
                    </div>

                    {!isEdit && (
                        <div className='space-y-2'>
                            <Label htmlFor='partner-slug'>Slug</Label>
                            <Input
                                id='partner-slug'
                                value={slug}
                                onChange={e => {
                                    setSlugTouched(true);
                                    setSlug(e.target.value);
                                }}
                                placeholder='getyourguide'
                            />
                            <p className='text-xs text-muted-foreground'>
                                Appears in logs and per-partner metrics.
                            </p>
                        </div>
                    )}

                    <div className='space-y-2'>
                        <Label htmlFor='partner-email'>Technical contact</Label>
                        <Input
                            id='partner-email'
                            type='email'
                            value={contactEmail}
                            onChange={e => setContactEmail(e.target.value)}
                            placeholder='connect@partner.example'
                        />
                        <p className='text-xs text-muted-foreground'>
                            Who to reach during an incident or a key rotation.
                        </p>
                    </div>

                    {!isEdit && (
                        <>
                            <div className='space-y-2'>
                                <Label>What they can see</Label>
                                <Select
                                    value={catalogScope}
                                    onValueChange={v =>
                                        setCatalogScope(
                                            v as PartnerCatalogScope,
                                        )
                                    }>
                                    <SelectTrigger className='w-full'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem
                                            value={
                                                PartnerCatalogScope.SINGLE_OPERATOR
                                            }>
                                            One operator&apos;s tours
                                        </SelectItem>
                                        <SelectItem
                                            value={
                                                PartnerCatalogScope.WHOLE_PLATFORM
                                            }>
                                            The whole marketplace
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className='text-xs text-muted-foreground'>
                                    Fixed once created - changing it later would
                                    silently change what every existing key can
                                    read.
                                </p>
                            </div>

                            {catalogScope ===
                                PartnerCatalogScope.SINGLE_OPERATOR && (
                                <div className='space-y-2'>
                                    <Label>Operator</Label>
                                    <Select
                                        value={operatorId}
                                        onValueChange={setOperatorId}>
                                        <SelectTrigger className='w-full'>
                                            <SelectValue placeholder='Choose an operator' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(operators?.data ?? []).map(op => (
                                                <SelectItem
                                                    key={op.id}
                                                    value={op.id}>
                                                    {getOperatorDisplayName(op)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className='text-xs text-muted-foreground'>
                                        This partner sees only this
                                        operator&apos;s tours, and only while
                                        that operator has distribution switched
                                        on.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    <div className='space-y-2'>
                        <Label htmlFor='partner-notes'>Notes</Label>
                        <Textarea
                            id='partner-notes'
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder='Contract reference, agreed rate, who signed it.'
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={pending || !name.trim() || needsOperator}>
                        {pending && (
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='size-4 animate-spin'
                            />
                        )}
                        {isEdit ? 'Save' : 'Create partner'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
