'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Pagination } from './pagination';

/**
 * URL-driven wrapper around the reusable <Pagination> for the search results
 * page. Reads the current page from `?page=`, and on change pushes a new URL
 * preserving the other params (`q`, `destination`). Page 1 drops the param for a
 * clean URL.
 */
export function SearchPagination({ pageCount }: { pageCount: number }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

    const go = (next: number) => {
        const sp = new URLSearchParams(params.toString());
        if (next <= 1) sp.delete('page');
        else sp.set('page', String(next));
        const qs = sp.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
    };

    return <Pagination page={page} pageCount={pageCount} onPageChange={go} />;
}
