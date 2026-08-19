'use client';

import { EntityDetailShell } from '@/components/common/entity-detail-shell';

interface OperatorDetailShellProps {
    id: string;
    name: string | undefined;
    isLoading: boolean;
    subtitle: string;
    children: React.ReactNode;
}

export function OperatorDetailShell({
    id,
    name,
    isLoading,
    subtitle,
    children,
}: OperatorDetailShellProps) {
    return (
        <EntityDetailShell
            listLabel='Tour Operators'
            listHref='/tour-operators'
            fallbackNoun='Operator'
            id={id}
            name={name}
            isLoading={isLoading}
            subtitle={subtitle}
        >
            {children}
        </EntityDetailShell>
    );
}
