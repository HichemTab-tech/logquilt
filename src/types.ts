export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface EntryBase {
    id: string;
    timestamp: string;
    segment: number;
}

export interface TextContent {
    kind: 'user' | 'assistant' | 'notice' | 'thinking';
    text: string;
    messageId?: string;
    model?: string;
    error?: boolean;
}

export interface ToolResult {
    text: string;
    isError: boolean;
    images: string[];
}

export interface ToolContent {
    kind: 'tool';
    name: string;
    input: JsonObject;
    toolId: string;
    model?: string;
    result: ToolResult | null;
    orphan?: boolean;
}

export interface CompactionContent {
    kind: 'compaction';
    text: string;
    summary: string;
    trigger?: string;
    preTokens?: number;
    postTokens?: number;
}

export type EntryContent =
    | TextContent
    | ToolContent
    | CompactionContent
    | { kind: 'duration'; text: string; durationMs: number }
    | { kind: 'image'; text: string; source: string | null };

export type TranscriptEntry = EntryBase & EntryContent;
export type ToolEntry = EntryBase & ToolContent;
export type CompactionEntry = EntryBase & CompactionContent;

export interface Transcript {
    entries: TranscriptEntry[];
    metadata: {
        name: string;
        sessionId: string;
        cwd: string;
        version: string;
        model: string;
        started: string;
        ended: string;
    };
    stats: {
        records: number;
        prompts: number;
        tools: number;
        compactions: number;
        duplicates: number;
        ignored: number;
    };
    warnings: { line: number; message: string }[];
}

export interface Conversation {
    id: number;
    name: string;
    size: number;
    data: Transcript;
}

export interface ParseRequest {
    type: 'parse';
    file: Blob;
}

export type ParseResponse =
    | { type: 'progress'; progress: number }
    | { type: 'parsed'; transcript: Transcript }
    | { type: 'error'; message: string };
