import { existsSync } from 'node:fs';
import { chromium, request as playwrightRequest } from 'playwright';
import type { Browser, Page, APIRequestContext } from 'playwright';
import { test as base, inject } from 'vitest';

interface Fixtures {
    baseUrl: string;
    browser: Browser;
    page: Page;
    request: APIRequestContext;
}

export const test = base.extend<Fixtures>({
    baseUrl: async ({}, use) => {
        await use(inject('baseUrl'));
    },
    browser: [
        async ({}, use) => {
            const executablePath =
                process.env.CHROMIUM_PATH ||
                (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
            const browser = await chromium.launch({
                executablePath,
                headless: true,
                args: ['--no-sandbox'],
            });
            try {
                await use(browser);
            } finally {
                await browser.close();
            }
        },
        { scope: 'file' },
    ],
    page: async ({ browser, baseUrl }, use) => {
        const context = await browser.newContext({ baseURL: baseUrl });
        try {
            await use(await context.newPage());
        } finally {
            await context.close();
        }
    },
    request: async ({ baseUrl }, use) => {
        const context = await playwrightRequest.newContext({ baseURL: baseUrl });
        try {
            await use(context);
        } finally {
            await context.dispose();
        }
    },
});

export { expect } from 'vitest';
