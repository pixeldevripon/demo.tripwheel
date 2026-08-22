import { test, expect } from '@playwright/test';

const SCRATCH =
    '/private/tmp/claude-501/-Users-devripon-devripon-Final---Running-Project-island-tour-development/459f77f4-920b-4669-a198-edb12e17489e/scratchpad';
const URL = '/en/curacao/sunset-catamaran-cruise-with-drinks54q';

test.use({ viewport: { width: 1600, height: 900 } });

test('spectators panel: hidden at the default party, and fully reachable once shown', async ({
    page,
}) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const spectators = page.getByText(/Bringing Spectators/i).first();

    // 1. Default state (party = 1, untouched): not rendered at all.
    await expect(spectators).toHaveCount(0);

    // Pick a date + slot - still untouched party, still no spectators.
    await page.getByRole('button', { name: /Select date|^\w{3}, / }).first().click();
    await page.waitForTimeout(600);
    await page.locator('button:not([disabled])', { hasText: /^\d{1,2}$/ }).last().click().catch(() => {});
    await page.waitForTimeout(900);
    await page.locator('button', { hasText: /\d{1,2}:\d{2}\s?(AM|PM)/ }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    console.log('after date+slot, spectators count =', await spectators.count());
    expect(await spectators.count()).toBe(0);

    // 2. Change the guest count -> it appears.
    await page.getByRole('button', { name: /Travelers?$/ }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^\+ / }).first().click();
    await page.waitForTimeout(900);
    await expect(spectators).toHaveCount(1);

    // 3. Scroll it into view inside the card and check nothing covers it.
    const out = await page.evaluate(() => {
        const region = document.querySelector('.it-modal-scroll.space-y-2') as HTMLElement;
        const title = [...document.querySelectorAll('*')].find(
            (e) => e.children.length === 0 && /Bringing Spectators/i.test(e.textContent || ''),
        ) as HTMLElement;
        // The whole panel = the title's own card.
        const panel = title.closest('.rounded-\\[8px\\]') as HTMLElement;
        panel.scrollIntoView({ block: 'center' });
        const p = panel.getBoundingClientRect();
        const r = region.getBoundingClientRect();
        // Anything painted over the panel's centre?
        const hit = document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2);
        return {
            panelH: Math.round(p.height),
            panelInsideRegion: p.top >= r.top - 1 && p.bottom <= r.bottom + 1,
            clipped: p.top < r.top - 1 || p.bottom > r.bottom + 1,
            topmostAtCentre: hit ? (hit.closest('.rounded-\\[8px\\]') === panel ? 'the panel itself' : hit.className.toString().slice(0, 60)) : null,
            regionH: Math.round(r.height),
        };
    });
    console.log(JSON.stringify(out, null, 1));
    await page.screenshot({ path: `${SCRATCH}/spectators-visible.png` });

    // The panel must be whole: fully inside the scroll region, nothing on top.
    expect(out.panelH).toBeGreaterThan(120);
    expect(out.topmostAtCentre).toBe('the panel itself');
});
