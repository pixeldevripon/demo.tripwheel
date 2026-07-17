'use client';

import { EntityDetailShell } from '@/components/common/entity-detail-shell';

interface HubDetailShellProps {
    id: string;
    name: string | undefined;
    isLoading: boolean;
    subtitle: string;
    children: React.ReactNode;
}

export function HubDetailShell({ id, name, isLoading, subtitle, children }: HubDetailShellProps) {
    return (
        <EntityDetailShell
            listLabel='Hubs'
            listHref='/hubs'
            fallbackNoun='Hub'
            id={id}
            name={name}
            isLoading={isLoading}
            subtitle={subtitle}
        >
            {children}
        </EntityDetailShell>
    );
}
