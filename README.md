# Logquilt

Logquilt is an independent, local viewer for Claude Code JSONL conversations. It uses a dark terminal layout and normal collapsed tool previews. Open a conversation and scroll; there are no chat actions, menus, or keyboard shortcuts.

## Run locally

```bash
npm install
npm run build
npm start
```

Open http://127.0.0.1:4173. Upload or drop a `.jsonl` or `.ndjson` file on the home page to read it. Use **Home** to upload another file or continue reading the current conversation. Files up to 512 MB are supported and stay in browser memory; refreshing clears the current upload.

To offer a local example on the home page, add `-- --file /absolute/path/to/conversation.jsonl` to `npm start`. It loads only when you click **Open example conversation**. Session files are usually under `~/.claude/projects/`.

## Development

```bash
npm run dev
npm test
npm run test:e2e
npm run build
```

Browser tests use `/usr/bin/chromium`; set `CHROMIUM_PATH` for another Chromium installation. Add `-- --port 4180` to the start or dev command to choose another port. Node.js 22 or later is required.

## Publish

Run `npm run build` and deploy the contents of `dist/` as a static site at **https://logquilt.hichemtab-tech.me/**. The build includes the rendered homepage, search/social metadata, sitemap, robots file, sharing image, and app icons. The Node server is for local use; a public deployment does not need it or the example transcript.

Public identity and URLs live in `site.config.mjs`. Run `npm run assets:brand` after changing the logo or social-card design. See [SEO and deployment notes](docs/seo.md).

Files stay local and are never copied into the project. Compaction boundaries remain visible, but discarded messages cannot be reconstructed from a summary. This is a visual recreation; JSONL does not store the original terminal's font, width, colors, or animations.

Details: [docs/implementation.md](docs/implementation.md).
