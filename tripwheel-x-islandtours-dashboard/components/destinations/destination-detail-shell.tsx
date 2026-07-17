'use client';

import { EntityDetailShell } from '@/components/common/entity-detail-shell';

interface DestinationDetailShellProps {
    id: string;
    name: string | undefined;
    isLoading: boolean;
    subtitle: string;
    maxWidth?: 'md' | 'lg';
    children: React.ReactNode;
}

export function DestinationDetailShell({ id, name, isLoading, subtitle, children }: DestinationDetailShellProps) {
    return (
        <EntityDetailShell
            listLabel='Destinations'
            listHref='/destinations'
            fallbackNoun='Destination'
            id={id}
            name={name}
            isLoading={isLoading}
            subtitle={subtitle}
        >
            {children}
        </EntityDetailShell>
    );
}
