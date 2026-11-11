import {test,expect} from '@playwright/test';
import {fixture} from './fixture.mjs';

const origin='https://logquilt.hichemtab-tech.me';

test('delivers searchable homepage content and creator credit without JavaScript',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  const page=await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4174');
    await expect(page).toHaveTitle('Logquilt — Claude Code JSONL Viewer');
    await expect(page.getByRole('heading',{name:'Your conversations, back in the terminal.'})).toBeVisible();
    await expect(page.getByRole('link',{name:'HichemTab-tech'})).toHaveAttribute('href','https://hichemtab-tech.me/');
    await expect(page.getByText(/Enable JavaScript to open/)).toBeVisible();
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',origin+'/');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content',origin+'/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content',origin+'/social-preview.png');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content','summary_large_image');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/Claude Code JSONL/);
    const graph=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];
    expect(graph.find(node=>node['@type']==='WebSite').url).toBe(origin+'/');
    expect(graph.find(node=>node['@type']==='WebApplication').author['@id']).toBe('https://hichemtab-tech.me/#person');
    expect(graph.find(node=>node['@type']==='Person').name).toBe('HichemTab-tech');
    expect(JSON.stringify(graph)).not.toMatch(/aggregateRating|reviewCount|example\.jsonl/);
  } finally {await context.close();}
});

test('serves crawl files, sharing image and icon assets with their proper types',async({request})=>{
  const robots=await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect(await robots.text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
  expect(await robots.text()).toContain('Disallow: /api/');
  const sitemap=await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('application/xml');
  expect(await sitemap.text()).toContain(`<loc>${origin}/</loc>`);
  expect(await sitemap.text()).not.toMatch(/#conversation|api\/|jsonl/);
  for(const [path,width,height] of [['social-preview.png',1200,630],['apple-touch-icon.png',180,180],['icon-192.png',192,192],['icon-512.png',512,512],['favicon-32x32.png',32,32]]) {
    const response=await request.get('/'+path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const bytes=await response.body();
    expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
    expect(bytes.readUInt32BE(16)).toBe(width);expect(bytes.readUInt32BE(20)).toBe(height);
  }
  const manifest=await request.get('/site.webmanifest');
  expect(manifest.headers()['content-type']).toContain('application/manifest+json');
  expect((await manifest.json()).name).toBe('Logquilt');
  const api=await request.get('/api/session');
  expect(api.headers()['x-robots-tag']).toContain('noindex');
});

test('hydrates the static homepage and keeps uploaded content out of sharing metadata',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'private-session.jsonl',mimeType:'application/json',buffer:Buffer.from(fixture())});
  await expect(page.getByRole('main')).toHaveAttribute('data-filename','private-session.jsonl');
  await expect(page.getByRole('link',{name:'HichemTab-tech'})).toHaveAttribute('href','https://hichemtab-tech.me/');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content','Logquilt — Claude Code JSONL Viewer');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',origin+'/');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content','noindex, nofollow');
  await page.getByRole('button',{name:'Back to home'}).click();
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content','index, follow, max-image-preview:large');
  await expect(page).toHaveTitle('Logquilt — Claude Code JSONL Viewer');
  expect(errors).toEqual([]);
});
