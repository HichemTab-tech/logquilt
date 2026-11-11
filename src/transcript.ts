import { isObject } from './types.ts';
import type {
    JsonObject,
    EntryContent,
    EntryBase,
    Transcript,
    TranscriptEntry,
    ToolEntry,
    ToolResult,
    CompactionEntry,
    ToolContent,
    TextContent,
} from './types.ts';

const ANSI = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g;
export const cleanText = (value: unknown): string =>
    String(value ?? '')
        .replace(ANSI, '')
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

export function contentText(content: unknown): string {
    if (typeof content === 'string') return cleanText(content);
    if (!Array.isArray(content))
        return content == null ? '' : cleanText(JSON.stringify(content, null, 2));
    return content
        .map((block) => {
            if (!isObject(block)) return '';
            if (block.type === 'text') return cleanText(block.text);
            if (block.type === 'image') return '[Image]';
            if (block.type === 'tool_reference') return `[Tool: ${cleanText(block.tool_name)}]`;
            if (block.type === 'resource')
                return isObject(block.resource)
                    ? cleanText(block.resource.text ?? block.resource.uri)
                    : '';
            return '';
        })
        .filter(Boolean)
        .join('\n');
}

export function parseTranscript(
    text: string,
    onProgress: (progress: number) => void = () => {},
): Transcript {
    const entries: TranscriptEntry[] = [];
    const warnings: Transcript['warnings'] = [];
    const seen = new Set<string>();
    const tools = new Map<string, ToolEntry>();
    const pending = new Map<string, ToolEntry>();
    const metadata = {
        name: '',
        sessionId: '',
        cwd: '',
        version: '',
        model: '',
        started: '',
        ended: '',
    };
    const stats = { records: 0, prompts: 0, tools: 0, compactions: 0, duplicates: 0, ignored: 0 };
    let segment = 0,
        entrySequence = 0;
    let lastBoundary: CompactionEntry | undefined;
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

    const add = <T extends EntryContent>(
        record: JsonObject,
        line: number,
        entry: T,
    ): EntryBase & T => {
        const item = {
            id: `${record.uuid || `line-${line}`}:${entrySequence++}`,
            timestamp: cleanText(record.timestamp),
            segment,
            ...entry,
        };
        entries.push(item);
        return item;
    };
    const addResult = (id: string, result: ToolResult, record: JsonObject, line: number) => {
        const existing = tools.get(id) ?? pending.get(id);
        if (existing) existing.result = result;
        else
            pending.set(
                id,
                add(record, line, {
                    kind: 'tool',
                    name: 'Tool result',
                    input: {},
                    toolId: id,
                    result,
                    orphan: true,
                }),
            );
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        let record: unknown;
        try {
            record = JSON.parse(line);
        } catch {
            warnings.push({ line: i + 1, message: 'Invalid JSON; this line was skipped.' });
            continue;
        }
        if (!isObject(record)) {
            warnings.push({
                line: i + 1,
                message: 'Expected a JSON object; this line was skipped.',
            });
            continue;
        }
        stats.records++;
        if (typeof record.uuid === 'string' && seen.has(record.uuid)) {
            stats.duplicates++;
            continue;
        }
        if (typeof record.uuid === 'string') seen.add(record.uuid);
        if (record.isSidechain) {
            stats.ignored++;
            continue;
        }
        if (i % 300 === 0) onProgress(Math.round((i / lines.length) * 100));

        if (record.type === 'custom-title') metadata.name = cleanText(record.customTitle);
        for (const [from, to] of [
            ['sessionId', 'sessionId'],
            ['cwd', 'cwd'],
            ['version', 'version'],
        ] as const) {
            if (typeof record[from] === 'string') metadata[to] = cleanText(record[from]);
        }
        if (typeof record.timestamp === 'string') {
            metadata.started ||= record.timestamp;
            metadata.ended = record.timestamp;
        }
        if (record.type === 'system') {
            if (record.subtype === 'compact_boundary') {
                segment++;
                stats.compactions++;
                const cm = isObject(record.compactMetadata) ? record.compactMetadata : {};
                lastBoundary = add(record, i, {
                    kind: 'compaction',
                    text: 'Conversation compacted',
                    summary: '',
                    trigger: cleanText(cm.trigger || 'auto'),
                    preTokens: typeof cm.preTokens === 'number' ? cm.preTokens : undefined,
                    postTokens: typeof cm.postTokens === 'number' ? cm.postTokens : undefined,
                });
            } else if (
                record.subtype === 'turn_duration' &&
                typeof record.durationMs === 'number' &&
                record.durationMs > 0
            ) {
                add(record, i, { kind: 'duration', text: '', durationMs: record.durationMs });
            } else if (
                record.subtype === 'local_command' ||
                record.level === 'error' ||
                record.level === 'warning'
            ) {
                const value = contentText(record.content);
                if (value)
                    add(record, i, {
                        kind: 'notice',
                        text: value,
                        error: record.level === 'error',
                    });
            }
            continue;
        }
        if (record.type !== 'user' && record.type !== 'assistant') {
            stats.ignored++;
            continue;
        }
        const message = record.message;
        if (!isObject(message)) continue;
        if (message.model && message.model !== '<synthetic>')
            metadata.model = cleanText(message.model);
        if (record.isCompactSummary) {
            const summary = contentText(message.content);
            if (lastBoundary)
                lastBoundary.summary += (lastBoundary.summary ? '\n\n' : '') + summary;
            else {
                segment++;
                stats.compactions++;
                lastBoundary = add(record, i, {
                    kind: 'compaction',
                    text: 'Conversation summary',
                    summary,
                });
            }
            continue;
        }
        if (record.isMeta) {
            stats.ignored++;
            continue;
        }
        const blocks =
            typeof message.content === 'string'
                ? [{ type: 'text', text: message.content }]
                : message.content;
        if (!Array.isArray(blocks)) continue;
        let isPrompt = false;
        for (const [index, block] of blocks.entries()) {
            if (!isObject(block)) continue;
            if (block.type === 'tool_result') {
                addResult(
                    typeof block.tool_use_id === 'string'
                        ? block.tool_use_id
                        : `${record.uuid}:${index}`,
                    {
                        text: contentText(block.content),
                        isError: !!block.is_error,
                        images: inlineImages(block.content),
                    },
                    record,
                    i,
                );
            } else if (block.type === 'tool_use' || block.type === 'server_tool_use') {
                const toolId =
                    typeof block.id === 'string'
                        ? block.id
                        : `${record.uuid || `line-${i}`}:${index}`;
                if (tools.has(toolId)) continue;
                const earlierResult = pending.get(toolId);
                if (earlierResult) entries.splice(entries.indexOf(earlierResult), 1);
                const tool = add(record, i, {
                    kind: 'tool',
                    name: cleanText(block.name || 'Tool'),
                    input: isObject(block.input) ? block.input : {},
                    toolId,
                    model: typeof message.model === 'string' ? message.model : undefined,
                    result: pending.get(toolId)?.result || null,
                });
                tools.set(toolId, tool);
                pending.delete(toolId);
                stats.tools++;
            } else if (block.type === 'thinking' && block.thinking) {
                add(record, i, {
                    kind: 'thinking',
                    text: cleanText(block.thinking),
                    model: typeof message.model === 'string' ? message.model : undefined,
                });
            } else if (block.type === 'text' && block.text) {
                let value = cleanText(block.text);
                let kind: TextContent['kind'] = record.type;
                if (value.includes('<local-command-stdout>')) {
                    value = value.replace(/<\/?local-command-stdout>/g, '').trim();
                    kind = 'notice';
                } else if (value.includes('<command-name>')) {
                    const name = value.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1];
                    const args = value.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1];
                    if (name) value = [name, args].filter(Boolean).join(' ');
                }
                if (!value) continue;
                const prev = entries.at(-1);
                if (
                    kind === 'assistant' &&
                    message.id &&
                    prev?.kind === kind &&
                    prev.messageId === message.id &&
                    prev.segment === segment
                )
                    prev.text += '\n\n' + value;
                else
                    add(record, i, {
                        kind,
                        text: value,
                        messageId: typeof message.id === 'string' ? message.id : undefined,
                        model: typeof message.model === 'string' ? message.model : undefined,
                        error: !!record.isApiErrorMessage,
                    });
                if (kind === 'user') isPrompt = true;
            } else if (block.type === 'image') {
                const source = safeImage(block.source);
                add(record, i, {
                    kind: 'image',
                    text: source
                        ? 'Image attachment'
                        : 'Image attachment (not embedded in transcript)',
                    source,
                });
                if (record.type === 'user') isPrompt = true;
            } else if (block.type === 'redacted_thinking') {
                add(record, i, {
                    kind: 'thinking',
                    text: '[Thinking was not saved in this transcript.]',
                });
            }
        }
        if (isPrompt) stats.prompts++;
    }
    onProgress(100);
    return { entries, metadata, stats, warnings };
}

function safeImage(source: unknown): string | null {
    if (
        !isObject(source) ||
        source.type !== 'base64' ||
        typeof source.media_type !== 'string' ||
        !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(source.media_type) ||
        typeof source.data !== 'string' ||
        !/^[A-Za-z0-9+/=\s]+$/.test(source.data)
    )
        return null;
    return `data:${source.media_type};base64,${source.data}`;
}
function inlineImages(content: unknown): string[] {
    return Array.isArray(content)
        ? content
              .filter(isObject)
              .filter((b) => b.type === 'image')
              .map((b) => safeImage(b.source))
              .filter((source): source is string => source !== null)
        : [];
}

export function toolLabel(entry: ToolContent): string {
    const input = entry.input || {};
    if (entry.name === 'Bash') return cleanText(input.command || input.description || '');
    if (['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(entry.name))
        return cleanText(input.file_path || input.notebook_path || '');
    if (entry.name === 'Grep' || entry.name === 'Glob') return cleanText(input.pattern || '');
    if (entry.name === 'Agent' || entry.name === 'Task')
        return cleanText(input.description || input.subagent_type || '');
    if (entry.name === 'WebFetch') return cleanText(input.url || '');
    if (entry.name === 'WebSearch' || entry.name === 'ToolSearch')
        return cleanText(input.query || '');
    if (entry.name === 'Skill') return cleanText(input.skill || '');
    return Object.entries(input)
        .map(
            ([key, value]) =>
                `${key}: ${typeof value === 'string' ? cleanText(value) : JSON.stringify(value)}`,
        )
        .join(', ');
}
