import { chromium } from '@playwright/test';

const URL = 'http://localhost:3000/en/curacao';

async function run(label, { timezoneId, cookie }) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ timezoneId });
    if (cookie) {
        await ctx.addCookies([
            {
                name: 'NEXT_CURRENCY',
                value: cookie,
                url: 'http://localhost:3000',
            },
        ]);
    }
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const cookies = await ctx.cookies();
    const stored = cookies.find(c => c.name === 'NEXT_CURRENCY')?.value ?? '(none)';
    const body = await page.evaluate(() => document.body.innerText);
    const usd = (body.match(/\$139\b/g) ?? []).length;
    const eur = (body.match(/€127[.,]88/g) ?? []).length;

    console.log(
        `${label.padEnd(38)} cookie=${stored.padEnd(7)} $139 x${usd}  €127.88 x${eur}`,
    );
    await browser.close();
}

await run('TZ America/New_York, no cookie', { timezoneId: 'America/New_York' });
await run('TZ Europe/Amsterdam, no cookie', { timezoneId: 'Europe/Amsterdam' });
await run('TZ Asia/Tokyo, no cookie', { timezoneId: 'Asia/Tokyo' });
await run('TZ America/New_York, cookie EUR', {
    timezoneId: 'America/New_York',
    cookie: 'EUR',
});
