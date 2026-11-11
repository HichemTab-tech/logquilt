# Search and social sharing

The canonical site is https://logquilt.hichemtab-tech.me/. The creator credit links to https://hichemtab-tech.me/. Both are public configuration in `site.config.mjs`, shared by the UI, metadata, and asset tools.

`npm run build` produces a static `dist/` directory. The Vite plugin renders the existing React homepage to HTML, and the client hydrates that markup. Crawlers and social-preview bots receive the title, description, canonical link, Open Graph and Twitter card tags, creator information, structured data, and homepage content without running JavaScript. The no-JavaScript notice explains that opening files requires the browser app.

Generated crawl files:

- `robots.txt` allows public assets and points to the sitemap; `/api/` is excluded.
- `sitemap.xml` lists only the canonical homepage.
- `site.webmanifest` supplies the application identity and 192/512-pixel icons. No service worker or offline capability is claimed.
- JSON-LD describes the WebSite, WebApplication, and its author. It includes no ratings or review claims.

The sharing image is `public/social-preview.png` (1200 × 630). It uses only synthetic conversation text. Browser and Apple touch icons are included as PNGs alongside the SVG favicon. Regenerate the committed assets with `npm run assets:brand`; its editable design is `scripts/social-card.html`, and its logo comes from `public/favicon.svg`. Regeneration requires Chromium, while ordinary production builds use the already committed assets.

Deploy `dist/` to a static host at the confirmed HTTPS domain. The local Node server intentionally binds to loopback and is not the public deployment server. Do not publish user JSONL files or the local `--file` sample. Uploaded content lives only in the visitor's browser; it is never included in the build, sitemap, social metadata, or structured data. The conversation view uses `noindex, nofollow` while the browser shows private content; returning home restores the homepage robots directive. The local API also sends an `X-Robots-Tag: noindex, nofollow` header.

After deployment, verify the public homepage, `/robots.txt`, `/sitemap.xml`, `/social-preview.png`, and `/site.webmanifest` return successfully over HTTPS. Search Console verification, sitemap submission, DNS configuration, and deployment are separate external actions. This change prepares the artifacts; it does not publish or submit them. Indexing and rich search results are decided by search engines.

References: [Google's JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and the [Open Graph protocol](https://ogp.me/).
