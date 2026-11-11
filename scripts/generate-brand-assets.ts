import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { site } from '../site.config.ts';

const publicDir = new URL('../public/', import.meta.url);
const svg = await readFile(new URL('favicon.svg', publicDir), 'utf8');
const template = await readFile(new URL('social-card.html', import.meta.url), 'utf8');
const html = template
    .replace('{{LOGO}}', svg)
    .replace('{{DOMAIN}}', new URL(site.url).hostname)
    .replace('{{AUTHOR}}', site.author.name);
const executablePath =
    process.env.CHROMIUM_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
await mkdir(publicDir, { recursive: true });
try {
    const page = await browser.newPage({
        viewport: { width: 1200, height: 630 },
        deviceScaleFactor: 1,
    });
    await page.route('**/*', (route) => route.abort());
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fileURLToPath(new URL(site.image, publicDir)) });
    const icons: [number, string][] = [
        [16, 'favicon-16x16.png'],
        [32, 'favicon-32x32.png'],
        [180, 'apple-touch-icon.png'],
        [192, 'icon-192.png'],
        [512, 'icon-512.png'],
    ];
    for (const [size, name] of icons) {
        await page.setViewportSize({ width: size, height: size });
        await page.setContent(
            `<html><head><style>html,body{margin:0;width:100%;height:100%;background:#1c1c1c}body{display:grid;place-items:center}svg{width:80%;height:80%}</style></head><body>${svg}</body></html>`,
        );
        await page.screenshot({ path: fileURLToPath(new URL(name, publicDir)) });
    }
    console.log('Created social-preview.png (1200×630) and five browser/touch icons.');
} finally {
    await browser.close();
}
