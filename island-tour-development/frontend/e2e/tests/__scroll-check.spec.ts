import { test, expect } from '@playwright/test';

const SCRATCH =
    '/private/tmp/claude-501/-Users-devripon-devripon-Final---Running-Project-island-tour-development/459f77f4-920b-4669-a198-edb12e17489e/scratchpad';

async function expandCard(page: import('@playwright/test').Page) {
    await page.goto('/en/sint-maarten/sunset-catamaran-cruise-with-drinks', {
        waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);

    await page
        .getByRole('button', { name: /Select date|^\w{3}, / })
        .first()
        .click();
    await page.waitForTimeout(600);
    // Any enabled day in the open month.
    const day = page
        .locator('button:not([disabled])', { hasText: /^\d{1,2}$/ })
        .last();
    if (await day.count()) await day.click().catch(() => {});
    await page.waitForTimeout(900);
    // Pick the first departure slot.
    await page
        .locator('button', { hasText: /\d{1,2}:\d{2}\s?(AM|PM)/ })
        .first()
        .click()
        .catch(() => {});
    await page.waitForTimeout(500);
    await page
        .getByRole('button', { name: /Travelers?$/ })
        .first()
        .click()
        .catch(() => {});
    await page.waitForTimeout(400);
    const plus = page.getByRole('button', { name: /^\+ / }).first();
    for (let i = 0; i < 4; i++) {
        await plus.click().catch(() => {});
        await page.waitForTimeout(180);
    }
    await page
        .getByRole('button', { name: /Show extras|Optional extras/i })
        .first()
        .click()
        .catch(() => {});
    await page.waitForTimeout(1200);
    // Scroll the page so the rail is actually pinned - unpinned it sits in
    // normal flow and every "is it inside the viewport" reading is meaningless.
    await page.mouse.move(300, 400);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(600);
}

async function measure(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const all = [...document.querySelectorAll('*')] as HTMLElement[];
        const scrollers = all.filter((e) => {
            const oy = getComputedStyle(e).overflowY;
            return (
                (oy === 'auto' || oy === 'scroll') &&
                e.scrollHeight > e.clientHeight + 1 &&
                e.clientHeight > 40
            );
        });
        const sticky = all.find((e) =>
            e.className.toString().includes('lg:sticky'),
        );
        const box = (sel: string) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
        };
        const cta = [...document.querySelectorAll('button')].find((b) =>
            /Continue|Check Availability/i.test(b.textContent || ''),
        );
        const ctaRect = cta?.getBoundingClientRect();
        const railRect = sticky?.getBoundingClientRect();
        // The card is what has to stay whole inside the viewport; the notices
        // below it may run past the fold and come back when the rail releases.
        const card = document
            .querySelector('.it-modal-scroll.space-y-2')
            ?.closest('.rounded-\\[16px\\]') as HTMLElement | undefined;
        const cardRect = card?.getBoundingClientRect();
        return {
            viewportH: window.innerHeight,
            scrollerCount: scrollers.length,
            scrollers: scrollers.map((e) => ({
                cls: e.className.toString().slice(0, 70),
                clientH: e.clientHeight,
                scrollH: e.scrollHeight,
            })),
            railHeight: railRect ? Math.round(railRect.height) : null,
            cardHeight: cardRect ? Math.round(cardRect.height) : null,
            cardFullyVisible: cardRect
                ? Math.round(cardRect.top) >= 0 &&
                  Math.round(cardRect.bottom) <= window.innerHeight
                : null,
            priceHeader: box('.lg\\:sticky p, .lg\\:sticky div'),
            ctaVisible: ctaRect
                ? ctaRect.bottom <= window.innerHeight && ctaRect.top >= 0
                : null,
            pageOverflowX:
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth,
        };
    });
}

test('1600x900: head pinned, one inner scroller, CTA on screen', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await expandCard(page);
    const out = await measure(page);
    console.log('1600x900', JSON.stringify(out, null, 1));
    await page.screenshot({ path: `${SCRATCH}/card-1600x900.png` });

    expect(out.cardFullyVisible).toBe(true);
    expect(out.ctaVisible).toBe(true);
    expect(out.pageOverflowX).toBe(false);

    // Exactly one scroller in the rail, and it is the card's selector region -
    // the calendar, the slots and the party stack all ride it together.
    expect(out.scrollerCount).toBe(1);
    expect(out.scrollers[0].cls).toContain('space-y-2');

    const REGION = '.it-modal-scroll.space-y-2';
    const before = await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        return el.getBoundingClientRect().top;
    }, REGION);
    const rbox = await page.locator(REGION).boundingBox();
    await page.mouse.move(rbox!.x + rbox!.width / 2, rbox!.y + rbox!.height / 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(500);
    const after = await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        return { top: el.getBoundingClientRect().top, scrollTop: el.scrollTop };
    }, REGION);
    console.log('scroll region before/after', before, after);
    await page.screenshot({ path: `${SCRATCH}/card-1600x900-scrolled.png` });
    expect(after.scrollTop).toBeGreaterThan(0);
    // The region's own box never moves while its content does: the price
    // header above and the CTA below stay pinned.
    expect(after.top).toBe(before);
});

test('1280x720 (short): still one scroller, CTA reachable', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await expandCard(page);
    const out = await measure(page);
    console.log('1280x720', JSON.stringify(out, null, 1));
    await page.screenshot({ path: `${SCRATCH}/card-1280x720.png` });
    expect(out.cardFullyVisible).toBe(true);
    expect(out.ctaVisible).toBe(true);
    // Still a single scroller, and the selectors keep their floor.
    expect(out.scrollerCount).toBe(1);
    expect(out.scrollers[0].clientH).toBeGreaterThanOrEqual(220);
});

test('1024x768 (touch tablet): the region scrolls but never traps the gesture', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await expandCard(page);
    const out = await page.evaluate(() => {
        const el = document.querySelector(
            '.it-modal-scroll.space-y-2',
        ) as HTMLElement;
        const cs = getComputedStyle(el);
        return {
            overflowY: cs.overflowY,
            overscrollY: cs.overscrollBehaviorY,
            scrolls: el.scrollHeight > el.clientHeight,
        };
    });
    console.log('1024x768', JSON.stringify(out));
    // At lg the card IS capped, so the region really scrolls - and because the
    // gesture chains, bottoming it out hands the drag back to the page instead
    // of stopping dead under the finger.
    expect(out.overflowY).toBe('auto');
    expect(out.overscrollY).toBe('auto');
});

test('390x844 (mobile): no inner scroll container on the card', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expandCard(page);
    const out = await page.evaluate(() => {
        const els = [
            ...document.querySelectorAll('.it-modal-scroll'),
        ] as HTMLElement[];
        return {
            count: els.length,
            styles: els.map((e) => ({
                cls: e.className.toString().slice(0, 60),
                overflowY: getComputedStyle(e).overflowY,
                overscroll: getComputedStyle(e).overscrollBehaviorY,
            })),
            pageOverflowX:
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth,
        };
    });
    console.log('390x844', JSON.stringify(out, null, 1));
    await page.screenshot({
        path: `${SCRATCH}/card-390x844.png`,
        fullPage: false,
    });
    // Every one of them, not just the first: any overflow:auto box that never
    // overflows is a touch dead zone once overscroll-behavior contains it.
    for (const s of out.styles) {
        expect(s.overflowY).toBe('visible');
        expect(s.overscroll).toBe('auto');
    }
    expect(out.pageOverflowX).toBe(false);

    // The page must actually move when the gesture starts ON each of those
    // boxes - that is the dead-zone regression, and only real input catches it.
    for (let i = 0; i < out.count; i++) {
        const pt = await page.evaluate((idx) => {
            const el = document.querySelectorAll('.it-modal-scroll')[
                idx
            ] as HTMLElement;
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            return {
                x: Math.round(r.left + r.width / 2),
                y: Math.round(r.top + r.height / 2),
                scrollY: Math.round(window.scrollY),
            };
        }, i);
        await page.mouse.move(pt.x, pt.y);
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(400);
        const afterY = await page.evaluate(() => Math.round(window.scrollY));
        console.log(`mobile drag over scroller ${i}:`, pt.scrollY, '->', afterY);
        expect(afterY).toBeGreaterThan(pt.scrollY);
    }
});
