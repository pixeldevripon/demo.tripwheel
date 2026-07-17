'use client';

import { EntityDetailShell } from '@/components/common/entity-detail-shell';

interface CategoryDetailShellProps {
    id: string;
    name: string | undefined;
    isLoading: boolean;
    subtitle: string;
    maxWidth?: 'md' | 'lg';
    children: React.ReactNode;
}

export function CategoryDetailShell({ id, name, isLoading, subtitle, children }: CategoryDetailShellProps) {
    return (
        <EntityDetailShell
            listLabel='Categories'
            listHref='/categories'
            fallbackNoun='Category'
            id={id}
            name={name}
            isLoading={isLoading}
            subtitle={subtitle}
        >
            {children}
        </EntityDetailShell>
    );
}
