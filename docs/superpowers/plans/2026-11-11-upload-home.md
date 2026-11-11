# Upload Home Page Implementation Plan

> **For agentic workers:** Implement inline using superpowers:executing-plans.

**Goal:** Add a home page for opening arbitrary Claude Code JSONL files in the existing scroll-only viewer.

**Architecture:** Keep uploads in browser memory and reuse the existing parsing worker. Split the home page and transcript view into components; App owns file loading and home/conversation navigation. The optional server-selected sample opens only when clicked. Hash navigation supports browser Back without changing server routes.

**Tech Stack:** Existing React, CSS, Vite, Playwright.

**Spec:** User requested a dynamic home page with JSONL uploads; retain the approved normal CLI view and no transcript shortcuts. Choose a file/drop on home, show progress and useful errors, return home or replace the active conversation. No persistence or remote upload is requested.

## Global Constraints

- Preserve normal collapsed transcript rendering and scrolling.
- Store file content only in browser memory, never in browser storage or upload requests.
- Keep the selected local example optional; landing page always opens first.

## Review Focus

- Loading a second or same-named file must replace the first conversation.
- Cancelled/superseded parsing or fetches must not replace a newer selection.
- Browser Back/Forward and Home must work without losing the active conversation.
- Invalid files must produce readable errors and allow retry.
- Home and viewer must fit mobile screens.

## Task 1: Verify the new entry flow

- [x] Add browser tests for home, upload, drag/drop, home/back navigation, replacement, and optional sample loading.
- [x] Run new tests and confirm current UI lacks the new flow.

## Task 2: Implement

- [x] Add HomePage.jsx and ConversationView.jsx, retaining TranscriptRow.
- [x] Update App.jsx to handle uploads, cancellation, optional sample loading, and navigation.
- [x] Add responsive home styling; update usage docs.

## Task 3: Verify and hand off

- [x] Run Node tests (11 passed) and browser tests (10 passed); production build passed.
- [x] Inspect synthetic desktop/mobile screenshots and the running home page; no overflow or browser errors.
- [x] Independent review of upload/loading/navigation changes returned no material findings.
