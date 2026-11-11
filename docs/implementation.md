# Logquilt transcript rendering

Logquilt uses its own name and woven-lines mark on the home page, viewer, and favicon. Claude Code appears only as a description of supported transcripts; imported model names and paths remain faithful to the source. The saved CLI version is not presented as Logquilt's version.

The user requested Claude Code CLI appearance and later explicitly limited the UI to viewing and scrolling. Normal collapsed tool previews are intentional. Thinking, long tool output, and compaction summary text are not expanded. There are no keyboard handlers or conversation actions.

The home page accepts one `.jsonl` or `.ndjson` file at a time through its upload button or drag-and-drop. File selection is processed in browser memory with a 512 MB limit; it never posts contents to the server or writes them to browser storage. App owns loading, cancellation, and hash/history navigation; HomePage provides the entry screen and ConversationView retains the scroll-only transcript. A small Home button returns to the upload page, where the latest parsed conversation can be resumed. Refreshing starts at home without retaining uploaded data. A server-configured example appears as an optional button and is fetched only on request.

The React view uses a worker to parse JSONL and TanStack Virtual to keep the DOM bounded. All user and assistant text remains in the normalized history; the viewport renders nearby rows. Markdown is displayed without raw HTML, active links, or automatic external images. Tools use the normal bullet, name, arguments, and indented three-line result preview. Edits show a short colored diff. The header reads the saved version, model, and working directory.

The parser pairs tool results by ID, deduplicates message UUIDs and repeated tool calls, merges adjacent assistant text belonging to the same message, retains compaction boundaries, and skips internal bookkeeping/API payload records and sidechains. Malformed lines are counted without including their contents in diagnostics. Missing tool calls/results are represented visibly.

The Node server binds to 127.0.0.1. Its `--file` argument selects the only file available from `/api/transcript`; browser uploads never leave browser memory. Host/origin validation protects local access. Production static serving is restricted to the built index, favicon, and assets. Build output contains no private conversation data.

The supplied session was tested in place, without copying it into source or fixtures. It contains 15,119 records, ten compactions, 143 human prompts, and 1,709 distinct tool calls. Tests use synthetic transcripts, and screenshots use synthetic content only.

Fidelity limits: saved files contain semantic events, not captured terminal frames. The renderer cannot recover discarded pre-compaction text, original terminal dimensions/colors, live animations, or custom/plugin renderers. Diff line numbers are relative to the saved replacement snippet. Use the original CLI for its exact live rendering.
