import { Fragment, type ReactNode } from 'react';

/**
 * Interpolate a dictionary template with RICH values: splits on `{token}`
 * placeholders and swaps each for the given ReactNode, so translated copy can
 * carry bold names/dates ("Your <b>{tour}</b> is reserved...") without the
 * component hardcoding the sentence order of any locale.
 */
export function renderTemplate(
    template: string,
    values: Record<string, ReactNode>,
): ReactNode {
    return template.split(/(\{\w+\})/g).map((part, i) => {
        const token = /^\{(\w+)\}$/.exec(part)?.[1];
        return token && token in values ? (
            <Fragment key={i}>{values[token]}</Fragment>
        ) : (
            part
        );
    });
}
