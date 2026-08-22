import { test } from '@playwright/test';
test('find the instagram panel', async ({ page }) => {
    await page.goto('/settings?tab=social');
    await page.waitForTimeout(3000);
    console.log('URL:', page.url());
    const body = (await page.locator('body').textContent()) ?? '';
    console.log('has Instagram:', body.includes('Instagram'));
    console.log('has Handle:', body.includes('Handle'));
    console.log('has @:', /@[a-z0-9_.]+/i.test(body));
    const m = body.match(/@[a-z0-9_.]{3,}/i);
    console.log('handle match:', m && m[0]);
    console.log('has Remove token btn:', body.includes('Remove token'));
    await page.screenshot({ path: 'e2e/__shots/ig-panel.png', fullPage: true });
});
