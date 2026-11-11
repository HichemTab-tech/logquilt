# Logquilt

Logquilt is an independent, local viewer for Claude Code JSONL conversations. It uses a dark terminal layout and normal collapsed tool previews. Open a conversation and scroll; there are no chat actions, menus, or keyboard shortcuts.

## Run locally

```bash
pnpm install
pnpm build
pnpm start
```

Open http://127.0.0.1:4173. Upload or drop a `.jsonl` or `.ndjson` file on the home page to read it. Use **Home** to upload another file or continue reading the current conversation. Files up to 512 MB are supported and stay in browser memory; refreshing clears the current upload.

Session files are usually under `~/.claude/projects/`.

## Development

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm format
pnpm check
```

Vitest runs the unit and browser tests; browser tests build the app automatically. Use `pnpm test:unit` or `pnpm test:e2e` to run either group. Browser tests use `/usr/bin/chromium` when available, or Playwright’s Chromium (`pnpm exec playwright install chromium`); set `CHROMIUM_PATH` for another installation. Add `--port 4180` to the start or dev command to choose another port. Node.js 22.12 or later and pnpm 12.15.0 are required.

TypeScript checks the app, worker, server, scripts, and configurations in strict mode. Prettier and EditorConfig use four-space indentation. `pnpm check` verifies formatting, types, and all tests.

## Publish

Run `pnpm build` and deploy the contents of `dist/` as a static site at **https://logquilt.hichemtab-tech.me/**. The build includes the rendered homepage, search/social metadata, sitemap, robots file, sharing image, and app icons. The Node server is for local use; a public deployment does not need it.

Public identity and URLs live in `site.config.ts`. Run `pnpm assets:brand` after changing the logo or social-card design. See [SEO and deployment notes](docs/seo.md).

Files stay local and are never copied into the project. Compaction boundaries remain visible, but discarded messages cannot be reconstructed from a summary. This is a visual recreation; JSONL does not store the original terminal's font, width, colors, or animations.

Details: [docs/implementation.md](docs/implementation.md).
