import { test } from '@playwright/test';
const TOKEN = 'v1.eyJlIjoidHJhdmVsZXIudDAyQGRlbW8uaXNsYW5kdG91cnMudGVzdCIsImgiOjEsImV4cCI6MTc4NTQ5MzU5NzM2M30.Mm2qxlo7nLD6fUh1wXEF93qPHuQXzZRm4UU3SKBm99o';
test('live link row', async ({ browser }) => {
    const c = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await c.addCookies([
        { name: 'it.travelerSession', value: TOKEN, domain: 'localhost', path: '/', httpOnly: true },
        { name: 'it.travellerAccount', value: encodeURIComponent('traveler.t02@demo.islandtours.test'), domain: 'localhost', path: '/' },
    ]);
    const p = await c.newPage();
    await p.goto('http://localhost:3000/en/traveller', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    await p.getByRole('button', { name: 'View details' }).first().click();
    await p.waitForTimeout(900);
    await p.locator('section[aria-label="Next trip"], section').filter({ hasText: 'Open booking page' }).first().screenshot({ path: 'e2e/__shots/live.png' });
});
