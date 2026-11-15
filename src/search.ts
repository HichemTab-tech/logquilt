import { cleanText, toolLabel } from './transcript.ts';
import { isObject } from './types.ts';
import type { JsonObject, TranscriptEntry } from './types.ts';

interface SearchField {
    source: 'Message' | 'Tool call' | 'Tool input' | 'Tool output' | 'Compaction summary';
    text: string;
}

export interface SearchDocument {
    entryIndex: number;
    fields: SearchField[];
}

export interface SearchMatch extends SearchField {
    entryIndex: number;
    start: number;
    end: number;
}

// Preserve literal strings (including code/newlines) in nested tool arguments.
function inputText(input: JsonObject): string {
    const stack: unknown[] = [input];
    const parts: string[] = [];
    while (stack.length) {
        const value = stack.pop();
        if (Array.isArray(value)) {
            for (let i = value.length - 1; i >= 0; i--) stack.push(value[i]);
        } else if (isObject(value)) {
            const entries = Object.entries(value);
            for (let i = entries.length - 1; i >= 0; i--) {
                stack.push(entries[i][1], entries[i][0]);
            }
        } else {
            parts.push(cleanText(value));
        }
    }
    return parts.join('\n');
}

export function indexTranscript(entries: readonly TranscriptEntry[]): SearchDocument[] {
    return entries.map((entry, entryIndex) => {
        let fields: SearchField[] = [];
        if (entry.kind === 'tool') {
            fields = [
                { source: 'Tool call', text: `${entry.name}(${toolLabel(entry)})` },
                { source: 'Tool input', text: inputText(entry.input) },
                { source: 'Tool output', text: entry.result?.text ?? '' },
            ];
        } else if (entry.kind === 'compaction') {
            fields = [{ source: 'Compaction summary', text: entry.summary }];
        } else if (entry.kind === 'user' || entry.kind === 'assistant' || entry.kind === 'notice') {
            fields = [{ source: 'Message', text: entry.text }];
        }
        return { entryIndex, fields };
    });
}

export function findMatches(documents: readonly SearchDocument[], query: string): SearchMatch[] {
    const term = query.trim();
    if (!term) return [];
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu');
    const matches: SearchMatch[] = [];
    for (const document of documents) {
        for (const field of document.fields) {
            const match = pattern.exec(field.text);
            if (match) {
                matches.push({
                    ...field,
                    entryIndex: document.entryIndex,
                    start: match.index,
                    end: match.index + match[0].length,
                });
                break;
            }
        }
    }
    return matches;
}

export function getMatchExcerpt(match: SearchMatch) {
    const start = Math.max(0, match.start - 80);
    const end = Math.min(match.text.length, match.end + 80);
    return {
        before: match.text.slice(start, match.start),
        match: match.text.slice(match.start, match.end),
        after: match.text.slice(match.end, end),
        leadingEllipsis: start > 0,
        trailingEllipsis: end < match.text.length,
    };
}
