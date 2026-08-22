'use client';

import { EntityDetailShell } from '@/components/common/entity-detail-shell';

interface CollectionDetailShellProps {
    id: string;
    name: string | undefined;
    isLoading: boolean;
    subtitle: string;
    children: React.ReactNode;
}

export function CollectionDetailShell({ id, name, isLoading, subtitle, children }: CollectionDetailShellProps) {
    return (
        <EntityDetailShell
            listLabel='Collections'
            listHref='/collections'
            fallbackNoun='Collection'
            id={id}
            name={name}
            isLoading={isLoading}
            subtitle={subtitle}
        >
            {children}
        </EntityDetailShell>
    );
}
