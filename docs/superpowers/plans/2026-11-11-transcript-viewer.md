# Claude Code Transcript Viewer Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** View saved and compacted Claude Code conversations in a faithful terminal-style browser UI. User steering: normal collapsed view; viewing and scrolling only, with no shortcuts or viewer controls.

**Architecture:** Normalize JSONL in a web worker; pair tools and results, retaining compaction segments. Render a virtualized React transcript and serve it with a localhost Node server that streams only an explicitly selected sample.

**Tech Stack:** React, Vite, react-markdown/remark-gfm, TanStack Virtual, Node test runner, Playwright.

**Spec:** ../specs/2026-11-11-transcript-viewer-design.md

## Global Constraints

- Never copy the real transcript into the repository or test artifacts.
- Bind local access to 127.0.0.1; no remote writes or publication.
- Render untrusted transcript content as text/safe Markdown; never execute commands.
- Do not claim exact pixel identity or recovery of discarded text.

## Review Focus

- Duplicate UUIDs and API request blobs must not duplicate visible conversation.
- Missing tool calls/results, malformed lines, and mixed content must retain usable history.
- Large transcripts and expanded long results must not lock up navigation.
- The static transcript must preserve earlier compaction segments and have no shortcut handlers.
- Host/origin validation and static serving must not expose arbitrary local files.

## Task 1: Parse saved conversations

Files: src/transcript.mjs, src/parser.worker.js, tests/transcript.test.mjs.
Interface: parseTranscript(text) returns entries, metadata, statistics, warnings. Entries have stable IDs, kind, text, timestamp, segment, and optional tool input/result data.

- [x] Write synthetic tests for tools/results, compaction, deduplication, malformed lines, hidden metadata, and mixed messages.
- [x] Run npm test and observe missing implementation failures.
- [x] Implement normalization and worker progress/error messages.
- [x] Run npm test; parser assertions pass. Real file: 15,119 records, ten compactions, zero parse warnings.

## Task 2: Render and navigate

Files: index.html, src/main.jsx, src/App.jsx, src/TranscriptRow.jsx, src/styles.css, tests/viewer.spec.js, playwright.config.js.
Interface: render normalized entries; expose file input and navigation controls to browser tests.

- [x] Write browser tests for file opening, collapsed tools, scrolling, unsafe content, and absence of controls.
- [x] Implement terminal layout, virtual scrolling, Markdown/diffs, and local file loading.
- [x] Run browser tests with Chromium and inspect synthetic screenshots at desktop/mobile sizes.

## Task 3: Local serving and handoff

Files: server.mjs, tests/server.test.mjs, README.md, docs/implementation.md.
Interface: npm run dev -- --file <path>; npm run build; npm start -- --file <path>. Only /api/transcript streams the selected file; /api/session returns nonsecret display metadata.

- [x] Write server tests for origin rejection, path traversal, unsupported methods, and missing/selected files.
- [x] Implement local server, safe static assets, and concise usage documentation.
- [x] Run npm test (11 passed), npm run test:e2e (5 passed), npm run build, and original-file browser verification.
- [x] Independent review identified orphan tool results losing their chronological position. Added a failing regression, fixed the order and segment, and passed the full suite. Local viewer runs at http://127.0.0.1:4173 with the user's file selected.

Final verification: the original file loaded in 861 ms in Chromium; its first and last visible entries matched parser output. At most 27 rows were mounted during sampled scrolling, with zero browser errors, zero external requests, and no horizontal page overflow. Development mode was separately verified with no browser errors. Exact pixel fidelity and private transcript content were not independently reviewed; the reviewer used synthetic inputs. No deferred material findings.
