'use client';

import { toast } from 'sonner';

import {
    QuickEditSheet,
    type QuickEditValues,
} from '@/components/common/quick-edit-sheet';
import { useUpdateCategory } from '@/hooks/categories/use-categories';
import type { CategoryLocalized } from '@/types/category';

interface CategoryQuickEditSheetProps {
    category: CategoryLocalized;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CategoryQuickEditSheet({
    category,
    open,
    onOpenChange,
}: CategoryQuickEditSheetProps) {
    const { mutate: updateCategory, isPending } = useUpdateCategory();

    function handleSave(values: QuickEditValues) {
        updateCategory(
            {
                id: category.id,
                payload: {
                    name: values.name,
                    heroImage: values.secondary || null,
                    isActive: values.isActive,
                },
            },
            {
                onSuccess: () => {
                    toast.success('Category updated successfully.');
                    onOpenChange(false);
                },
                onError: err => {
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update category.',
                    );
                },
            },
        );
    }

    return (
        <QuickEditSheet
            open={open}
            onOpenChange={onOpenChange}
            entityNoun='category'
            entityName={category.name}
            defaults={{
                name: category.name,
                secondary: category.heroImage ?? '',
                isActive: category.isActive,
            }}
            secondaryField={{
                label: 'Hero Image URL',
                placeholder: 'https://example.com/image.jpg',
                kind: 'url',
            }}
            isPending={isPending}
            onSave={handleSave}
        />
    );
}
