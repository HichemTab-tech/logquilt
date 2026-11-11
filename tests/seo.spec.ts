import { test, expect } from './browser.fixture.ts';
import { fixture } from './fixture.ts';

const origin = 'https://logquilt.hichemtab-tech.me';

test('delivers searchable homepage content and creator credit without JavaScript', async ({
    browser,
    baseUrl,
}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
        await page.goto(baseUrl);
        await expect.poll(() => page.title()).toBe('Logquilt — Claude Code JSONL Viewer');
        await expect
            .poll(() =>
                page
                    .getByRole('heading', { name: 'Your conversations, back in the terminal.' })
                    .isVisible(),
            )
            .toBe(true);
        await expect
            .poll(() => page.getByRole('link', { name: 'HichemTab-tech' }).getAttribute('href'))
            .toBe('https://hichemtab-tech.me/');
        await expect.poll(() => page.getByText(/Enable JavaScript to open/).isVisible()).toBe(true);
        await expect
            .poll(() => page.locator('link[rel=canonical]').getAttribute('href'))
            .toBe(origin + '/');
        await expect
            .poll(() => page.locator('meta[property="og:url"]').getAttribute('content'))
            .toBe(origin + '/');
        await expect
            .poll(() => page.locator('meta[property="og:image"]').getAttribute('content'))
            .toBe(origin + '/social-preview.png');
        await expect
            .poll(() => page.locator('meta[name="twitter:card"]').getAttribute('content'))
            .toBe('summary_large_image');
        await expect
            .poll(() => page.locator('meta[name="description"]').getAttribute('content'))
            .toMatch(/Claude Code JSONL/);
        const graph: Record<string, unknown>[] = JSON.parse(
            (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
        )['@graph'];
        expect(graph.find((node) => node['@type'] === 'WebSite')?.url).toBe(origin + '/');
        expect(graph.find((node) => node['@type'] === 'WebApplication')?.author).toEqual({
            '@id': 'https://hichemtab-tech.me/#person',
        });
        expect(graph.find((node) => node['@type'] === 'Person')?.name).toBe('HichemTab-tech');
        expect(JSON.stringify(graph)).not.toMatch(/aggregateRating|reviewCount|example\.jsonl/);
    } finally {
        await context.close();
    }
});

test('serves crawl files, sharing image and icon assets with their proper types', async ({
    request,
}) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(robots.headers()['content-type']).toContain('text/plain');
    expect(await robots.text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
    expect(await robots.text()).toContain('Disallow: /api/');
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toContain('application/xml');
    expect(await sitemap.text()).toContain(`<loc>${origin}/</loc>`);
    expect(await sitemap.text()).not.toMatch(/#conversation|api\/|jsonl/);
    for (const [path, width, height] of [
        ['social-preview.png', 1200, 630],
        ['apple-touch-icon.png', 180, 180],
        ['icon-192.png', 192, 192],
        ['icon-512.png', 512, 512],
        ['favicon-32x32.png', 32, 32],
    ]) {
        const response = await request.get('/' + path);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('image/png');
        const bytes = await response.body();
        expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect(bytes.readUInt32BE(16)).toBe(width);
        expect(bytes.readUInt32BE(20)).toBe(height);
    }
    const manifest = await request.get('/site.webmanifest');
    expect(manifest.headers()['content-type']).toContain('application/manifest+json');
    expect((await manifest.json()).name).toBe('Logquilt');
    const api = await request.get('/api/session');
    expect(api.headers()['x-robots-tag']).toContain('noindex');
});

test('hydrates the static homepage and keeps uploaded content out of sharing metadata', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({
        name: 'private-session.jsonl',
        mimeType: 'application/json',
        buffer: Buffer.from(fixture()),
    });
    await expect
        .poll(() => page.getByRole('main').getAttribute('data-filename'))
        .toBe('private-session.jsonl');
    await expect
        .poll(() => page.getByRole('link', { name: 'HichemTab-tech' }).getAttribute('href'))
        .toBe('https://hichemtab-tech.me/');
    await expect
        .poll(() => page.locator('meta[property="og:title"]').getAttribute('content'))
        .toBe('Logquilt — Claude Code JSONL Viewer');
    await expect
        .poll(() => page.locator('link[rel=canonical]').getAttribute('href'))
        .toBe(origin + '/');
    await expect
        .poll(() => page.locator('meta[name=robots]').getAttribute('content'))
        .toBe('noindex, nofollow');
    await page.getByRole('button', { name: 'Back to home' }).click();
    await expect
        .poll(() => page.locator('meta[name=robots]').getAttribute('content'))
        .toBe('index, follow, max-image-preview:large');
    await expect.poll(() => page.title()).toBe('Logquilt — Claude Code JSONL Viewer');
    expect(errors).toEqual([]);
});
