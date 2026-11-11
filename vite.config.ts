import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer, defineConfig, type HtmlTagDescriptor } from 'vite';
import { fileURLToPath } from 'node:url';
import { site } from './site.config.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const absolute = (path: string) => new URL(path, site.url).href;
const personId = `${site.author.url}#person`;
const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'WebSite',
            '@id': `${site.url}#website`,
            name: site.name,
            url: site.url,
            description: site.description,
            inLanguage: 'en',
            author: { '@id': personId },
        },
        {
            '@type': 'WebApplication',
            '@id': `${site.url}#app`,
            name: site.name,
            url: site.url,
            description: site.description,
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Any',
            browserRequirements: 'Requires JavaScript and a modern web browser.',
            image: absolute(site.image),
            isAccessibleForFree: true,
            author: { '@id': personId },
            featureList: [
                'Read Claude Code JSONL transcripts',
                'Process files in your browser',
                'Follow compaction boundaries',
                'View tool calls and results',
            ],
        },
        { '@type': 'Person', '@id': personId, name: site.author.name, url: site.author.url },
    ],
};
const files: Record<string, { type: string; source: string }> = {
    'robots.txt': {
        type: 'text/plain; charset=utf-8',
        source: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${absolute('sitemap.xml')}\n`,
    },
    'sitemap.xml': {
        type: 'application/xml; charset=utf-8',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site.url}</loc></url></urlset>\n`,
    },
    'site.webmanifest': {
        type: 'application/manifest+json',
        source: JSON.stringify(
            {
                id: '/',
                name: site.name,
                short_name: site.name,
                description: site.description,
                lang: 'en',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                background_color: site.themeColor,
                theme_color: site.themeColor,
                icons: [192, 512].map((size) => ({
                    src: `/icon-${size}.png`,
                    sizes: `${size}x${size}`,
                    type: 'image/png',
                    purpose: 'any',
                })),
            },
            null,
            4,
        ),
    },
};

function metadataTags(): HtmlTagDescriptor[] {
    const named = {
        description: site.description,
        author: site.author.name,
        robots: site.robots,
        'application-name': site.name,
        'theme-color': site.themeColor,
        'color-scheme': 'dark',
        'twitter:card': 'summary_large_image',
        'twitter:title': site.title,
        'twitter:description': site.description,
        'twitter:image': absolute(site.image),
        'twitter:image:alt': site.imageAlt,
    };
    const properties = {
        'og:type': 'website',
        'og:site_name': site.name,
        'og:locale': 'en_US',
        'og:title': site.title,
        'og:description': site.description,
        'og:url': site.url,
        'og:image': absolute(site.image),
        'og:image:secure_url': absolute(site.image),
        'og:image:type': 'image/png',
        'og:image:width': '1200',
        'og:image:height': '630',
        'og:image:alt': site.imageAlt,
    };
    const links: Record<string, string>[] = [
        { rel: 'canonical', href: site.url },
        { rel: 'author', href: site.author.url },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
    ];
    return [
        { tag: 'title', children: site.title, injectTo: 'head' as const },
        ...Object.entries(named).map(([name, content]) => ({
            tag: 'meta',
            attrs: { name, content },
            injectTo: 'head' as const,
        })),
        ...Object.entries(properties).map(([property, content]) => ({
            tag: 'meta',
            attrs: { property, content },
            injectTo: 'head' as const,
        })),
        ...links.map((attrs) => ({ tag: 'link', attrs, injectTo: 'head' as const })),
        {
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
            injectTo: 'head' as const,
        },
    ];
}

export default defineConfig(({ command }) => ({
    plugins: [
        {
            name: 'logquilt-static-seo',
            transformIndexHtml: {
                order: 'pre',
                async handler(html) {
                    if (command === 'build') {
                        // A separate, config-free module loader prevents recursive plugin execution.
                        const renderer = await createServer({
                            root,
                            configFile: false,
                            server: { middlewareMode: true, hmr: false },
                        });
                        try {
                            const { default: App } = (await renderer.ssrLoadModule(
                                '/src/App.tsx',
                            )) as typeof import('./src/App.tsx');
                            html = html.replace(
                                '<div id="root"></div>',
                                `<div id="root">${renderToString(createElement(App))}</div>`,
                            );
                        } finally {
                            await renderer.close();
                        }
                    }
                    return { html, tags: metadataTags() };
                },
            },
            generateBundle() {
                for (const [fileName, file] of Object.entries(files))
                    this.emitFile({ type: 'asset', fileName, source: file.source });
            },
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    const key = new URL(req.url ?? '/', 'http://localhost').pathname.slice(1);
                    if (!Object.hasOwn(files, key)) return next();
                    const file = files[key];
                    res.setHeader('Content-Type', file.type);
                    res.end(req.method === 'HEAD' ? undefined : file.source);
                });
            },
        },
    ],
}));
