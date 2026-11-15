import type { Page } from 'playwright';
import { test, expect } from './browser.fixture.ts';
import { fixture } from './fixture.ts';

async function open(page: Page, text = fixture()) {
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({
        name: 'search.jsonl',
        mimeType: 'application/json',
        buffer: Buffer.from(text),
    });
    await expect
        .poll(() => page.getByRole('main').getAttribute('data-filename'))
        .toBe('search.jsonl');
}

async function expectVisibleResult(page: Page, text: string) {
    const active = page.locator('[data-search-active=true]');
    await expect.poll(() => active.textContent()).toContain(text);
    await expect
        .poll(() =>
            active.evaluate((element) => {
                const viewport = element.closest('main')!.getBoundingClientRect();
                const row = element.getBoundingClientRect();
                return row.top >= viewport.top - 2 && row.top < viewport.bottom;
            }),
        )
        .toBe(true);
}

test('navigates literal search results across a large virtualized transcript and wraps', async ({
    page,
}) => {
    const targets = new Set([20, 700, 1499]);
    const rows = Array.from({ length: 1500 }, (_, i) =>
        JSON.stringify({
            type: 'user',
            uuid: `search-${i}`,
            message: {
                content: targets.has(i)
                    ? `Result ${i}: find.me[0]`
                    : `Message ${i}\n${'Extra line\n'.repeat(i % 9)}`,
            },
        }),
    ).join('\n');
    await open(page, rows);
    await page.getByRole('searchbox', { name: 'Search conversation' }).fill('FIND.ME[0]');
    await expect.poll(() => page.locator('#search-status').textContent()).toBe('1 of 3 results');
    await expectVisibleResult(page, 'Result 20:');
    await page.getByRole('button', { name: 'Next result' }).click();
    await expectVisibleResult(page, 'Result 700:');
    await page.getByRole('button', { name: 'Next result' }).click();
    await expectVisibleResult(page, 'Result 1499:');
    await expect.poll(() => page.locator('#search-status').textContent()).toBe('3 of 3 results');
    await page.getByRole('button', { name: 'Next result' }).click();
    await expectVisibleResult(page, 'Result 20:');
    await page.getByRole('button', { name: 'Previous result' }).click();
    await expectVisibleResult(page, 'Result 1499:');
    expect(await page.locator('[data-entry-id]').count()).toBeLessThan(80);
    await page.getByRole('searchbox', { name: 'Search conversation' }).fill('Result 20:');
    await expect.poll(() => page.locator('#search-status').textContent()).toBe('1 of 1 results');
    await expectVisibleResult(page, 'Result 20:');
    await page.getByRole('main').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    await expect
        .poll(() => page.getByText('Result 1499: find.me[0]', { exact: true }).isVisible())
        .toBe(true);
    await page.getByRole('button', { name: 'Next result' }).click();
    await expectVisibleResult(page, 'Result 20:');
});

test('shows highlighted excerpts from collapsed tool output, arguments, and summaries', async ({
    page,
}) => {
    await open(page);
    const search = page.getByRole('searchbox', { name: 'Search conversation' });
    await search.fill('secret-search-target');
    await expect.poll(() => page.locator('#search-status').textContent()).toBe('1 of 1 results');
    await expect
        .poll(() => page.locator('.search-preview mark').textContent())
        .toBe('secret-search-target');
    await expect.poll(() => page.locator('.search-source').textContent()).toBe('Tool output');
    await expectVisibleResult(page, 'Bash(npm test)');
    await search.fill('return "Hello, world!";');
    await expect.poll(() => page.locator('.search-source').textContent()).toBe('Tool input');
    await expect
        .poll(() => page.locator('.search-preview mark').textContent())
        .toBe('return "Hello, world!";');
    await search.fill('previous conversation updated');
    await expect
        .poll(() => page.locator('.search-source').textContent())
        .toBe('Compaction summary');
    await expectVisibleResult(page, 'Conversation compacted');
});

test('handles no results and clearing, and resets for another conversation', async ({ page }) => {
    await open(page);
    const search = page.getByRole('searchbox', { name: 'Search conversation' });
    await search.fill('unknown search phrase');
    await expect.poll(() => page.locator('#search-status').textContent()).toBe('No results');
    expect(await page.getByRole('button', { name: 'Next result' }).isDisabled()).toBe(true);
    expect(await page.getByRole('button', { name: 'Previous result' }).isDisabled()).toBe(true);
    await search.fill('greeting');
    await expect
        .poll(() => page.locator('#search-status').textContent())
        .toMatch(/1 of \d+ results/);
    await page.getByRole('button', { name: 'Clear search' }).click();
    expect(await search.inputValue()).toBe('');
    await search.fill('greeting');
    await page.getByRole('button', { name: 'Back to home' }).click();
    await page.locator('input[type=file]').setInputFiles({
        name: 'next.jsonl',
        mimeType: 'application/json',
        buffer: Buffer.from(fixture()),
    });
    await expect
        .poll(() => page.getByRole('main').getAttribute('data-filename'))
        .toBe('next.jsonl');
    expect(await search.inputValue()).toBe('');
});

test('keeps the selected highlight visible inside multiline tool output excerpts', async ({
    page,
}) => {
    const rows = [
        {
            type: 'assistant',
            uuid: 'multiline-call',
            message: {
                content: [
                    {
                        type: 'tool_use',
                        id: 'multiline-tool',
                        name: 'Bash',
                        input: { command: 'inspect' },
                    },
                ],
            },
        },
        {
            type: 'user',
            uuid: 'multiline-result',
            message: {
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: 'multiline-tool',
                        content: `${'x\n'.repeat(80)}needle\nafter`,
                    },
                ],
            },
        },
    ]
        .map((record) => JSON.stringify(record))
        .join('\n');
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, rows);
    await page.getByRole('searchbox', { name: 'Search conversation' }).fill('needle');
    await expect
        .poll(() =>
            page.locator('.search-preview mark').evaluate((mark) => {
                const preview = mark.parentElement!.getBoundingClientRect();
                const highlight = mark.getBoundingClientRect();
                return highlight.top >= preview.top && highlight.bottom <= preview.bottom;
            }),
        )
        .toBe(true);
});

test('keeps search local, safely renders excerpts, and fits a phone', async ({ page }) => {
    const rows = JSON.stringify({
        type: 'assistant',
        uuid: 'safe-search',
        message: {
            content:
                '<img src="https://example.com/track" onerror="window.pwned=true"> private-needle',
        },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, rows);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    const search = page.getByRole('searchbox', { name: 'Search conversation' });
    await search.fill('private-needle');
    await expect
        .poll(() => page.locator('.search-preview mark').textContent())
        .toBe('private-needle');
    expect(await search.evaluate((input) => input === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
    );
    expect(await page.evaluate(() => Reflect.get(window, 'pwned'))).toBeUndefined();
    expect(requests).toEqual([]);
    expect(page.url()).not.toContain('private-needle');
    expect(
        await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
    ).toEqual({ local: 0, session: 0 });
});
