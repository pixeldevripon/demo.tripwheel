import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * All-sold-out recovery (technical-doc/02-architecture/AVAILABILITY-AND-DEPARTURES.md §8).
 *
 * A tour with no open departure in the next 30 days must not present a blank
 * calendar. The widget replaces the whole selector stack with the headline plus
 * 2-3 tours in the same destination that still have room this week.
 *
 * The headline wording is a product decision, not free copy - see §8 in the doc.
 *
 * The dead-end tour is DISCOVERED from the API rather than hardcoded: which
 * seeded tour happens to be sold out shifts every time the demo data is
 * regenerated, and a spec pinned to one slug would fail for the wrong reason.
 */

const BACKEND =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050';
const HORIZON_DAYS = 30;

interface Candidate {
    id: string;
    slug: string;
    destinationSlug: string | null;
}

/** `yyyy-MM-dd`, local parts (the calendar API's date keys are plain dates). */
function dateKey(d: Date): string {
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
    ].join('-');
}

/** True when the tour has NO available calendar day inside the 30-day horizon. */
async function isDeadEnd(
    api: APIRequestContext,
    tourId: string
): Promise<boolean> {
    const now = new Date();
    const to = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + HORIZON_DAYS
    );
    const res = await api.post(`${BACKEND}/api/v1/availability/calendar`, {
        data: {
            tourId,
            dateFrom: dateKey(now),
            dateTo: dateKey(to),
        },
    });
    if (!res.ok()) return false;
    const days = (await res.json()) as { available: boolean }[];
    return !days.some(d => d.available);
}

test('a sold-out tour recovers with alternatives instead of a blank calendar', async ({
    page,
    request,
}) => {
    const listed = await request.get(
        `${BACKEND}/api/v1/tours?limit=50&locale=en`
    );
    expect(listed.ok()).toBeTruthy();
    const { data } = (await listed.json()) as { data: Candidate[] };

    let target: Candidate | null = null;
    for (const t of data) {
        if (!t.destinationSlug) continue;
        if (await isDeadEnd(request, t.id)) {
            target = t;
            break;
        }
    }
    test.skip(
        target === null,
        'No LIVE tour is currently in the all-sold-out state - nothing to assert.'
    );
    const tour = target!;

    const errors: string[] = [];
    page.on('console', m => {
        if (m.type() === 'error') errors.push(m.text().split('\n')[0]);
    });

    await page.goto(`/en/${tour.destinationSlug}/${tour.slug}`);

    // The locked headline (§8).
    await expect(
        page.getByText('These trips still have departures this week')
    ).toBeVisible({ timeout: 20_000 });

    // Every dead control is gone - not just the calendar.
    await expect(page.getByText('Select date')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: /check availability|continue/i })
    ).toHaveCount(0);

    // 2-3 alternatives, each naming the date it is next open and linking to a
    // flat tour URL. (Filtered on "Next:" so the page's own related-tours grid
    // further down, which uses the same <li><a> shape, is not counted.)
    const rows = page
        .locator(`li a[href^="/en/${tour.destinationSlug}/"]`)
        .filter({ hasText: /Next: / });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(3);
    // Never the tour the traveller is already looking at.
    await expect(
        rows.filter({ has: page.locator(`[href$="/${tour.slug}"]`) })
    ).toHaveCount(0);

    // A missing dictionary key here throws on `.replace()` and takes the whole
    // widget down, so an empty console is part of the assertion.
    expect(errors).toEqual([]);
});
