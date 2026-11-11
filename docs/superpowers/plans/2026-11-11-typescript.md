# TypeScript and tooling migration

Work directly on `master` after fast-forwarding the existing feature commits. Keep the history linear and preserve the viewer's read-only behavior, local file handling, and SEO output.

1. Convert React, the parser and worker, Node server, Vite configuration, asset generator, and tests to strict TypeScript. Share normalized transcript and worker message types; validate untrusted JSON at runtime.
2. Replace the npm lockfile with pnpm's lockfile, pin the package manager, and update local development commands.
3. Configure Prettier and EditorConfig for four-space indentation and format the project.
4. Run parser, server, and browser integration tests through Vitest. Keep Playwright only as the browser driver, with an isolated local test server.
5. Verify formatting, type checking, production build, tests, and a local development smoke check. Review and commit the migration on `master`.
