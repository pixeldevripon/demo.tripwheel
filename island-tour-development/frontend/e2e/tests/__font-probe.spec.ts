import { test, expect } from '@playwright/test';

const SCRATCH =
    '/private/tmp/claude-501/-Users-devripon-devripon-Final---Running-Project-island-tour-development/459f77f4-920b-4669-a198-edb12e17489e/scratchpad';

test.use({ viewport: { width: 1600, height: 900 } });

const SANS = /SF Pro|-apple-system/;

test('portalled surfaces (calendar + policy modals) inherit the SF Pro stack', async ({
    page,
}) => {
    await page.goto('/en/curacao/sunset-catamaran-cruise-with-drinks54q', {
        waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2500);

    const fontOf = (sel: string) =>
        page.evaluate((s) => {
            const el = document.querySelector(s);
            return el ? getComputedStyle(el).fontFamily : null;
        }, sel);

    expect(await fontOf('html')).toMatch(SANS);
    expect(await fontOf('body')).toMatch(SANS);

    // Calendar popover (portalled to document.body).
    await page.getByRole('button', { name: /Select date|^\w{3}, / }).first().click();
    await page.waitForTimeout(700);
    const calFont = await page.evaluate(() => {
        const portal = [...document.body.children].find(
            (c) => !c.classList.contains('frontend-root') && c.textContent?.includes('Mon'),
        );
        return portal ? getComputedStyle(portal).fontFamily : null;
    });
    console.log('calendar popover font:', calFont);
    expect(calFont).toMatch(SANS);
    await page.screenshot({ path: `${SCRATCH}/font-calendar.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Policy modal.
    await page.getByRole('button', { name: /Free cancellation/i }).first().click();
    await page.waitForTimeout(700);
    const modalFont = await page.evaluate(() => {
        const heading = [...document.querySelectorAll('h2, h3, [role="dialog"] *')].find(
            (e) => /Free cancellation/i.test(e.textContent || ''),
        );
        return heading ? getComputedStyle(heading).fontFamily : null;
    });
    console.log('policy modal font:', modalFont);
    expect(modalFont).toMatch(SANS);
    await page.screenshot({ path: `${SCRATCH}/font-modal.png` });
});
