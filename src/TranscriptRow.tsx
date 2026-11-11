import React from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { diffLines } from 'diff';
import { cleanText, toolLabel } from './transcript.ts';

import type { JsonObject, TranscriptEntry } from './types.ts';

const components: Components = {
    a: ({ children }) => <span className="markdown-link">{children}</span>,
    img: ({ alt }) => <span className="muted">[Image{alt ? `: ${alt}` : ''}]</span>,
};
function RichText({ text }: { text: string }) {
    return (
        <div className="markdown">
            <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
                {text}
            </Markdown>
        </div>
    );
}
function Diff({ input }: { input: JsonObject }) {
    const before = cleanText(input.old_string),
        after = cleanText(input.new_string);
    if (before.length + after.length > 60000)
        return (
            <span className="muted">
                Large edit · {before.split('\n').length} lines replaced with{' '}
                {after.split('\n').length} lines
            </span>
        );
    const parts = diffLines(before, after, { timeout: 30 }) || [
        { removed: true, added: false, value: before },
        { added: true, removed: false, value: after },
    ];
    let lineNumber = 1;
    const lines = parts.flatMap((part) =>
        part.value
            .replace(/\n$/, '')
            .split('\n')
            .map((text) => ({
                text,
                kind: part.added ? 'added' : part.removed ? 'removed' : 'context',
                number: part.removed ? '' : lineNumber++,
            })),
    );
    return (
        <div className="diff">
            {lines.slice(0, 8).map((line, i) => (
                <div key={i} className={`diff-line ${line.kind}`}>
                    <span className="line-number">{line.number}</span>
                    <span className="diff-sign">
                        {line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
                    </span>
                    <span>{line.text || ' '}</span>
                </div>
            ))}
            {lines.length > 8 && <span className="muted">… +{lines.length - 8} lines</span>}
        </div>
    );
}
export function modelName(model = '') {
    return model
        .replace(/^claude-/, '')
        .replace(/-\d{8}$/, '')
        .replace(
            /^(opus|sonnet|haiku)-(\d+)-(\d+)$/i,
            (_: string, name: string, major: string, minor: string) =>
                `${name[0].toUpperCase() + name.slice(1)} ${major}.${minor}`,
        )
        .replace(
            /^(opus|sonnet|haiku)-(\d+)$/i,
            (_: string, name: string, version: string) =>
                `${name[0].toUpperCase() + name.slice(1)} ${version}`,
        );
}
const duration = (ms: number) =>
    ms < 60000
        ? `${Math.round(ms / 1000)}s`
        : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;

export default function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
    const props = { 'data-entry-id': entry.id, className: `entry entry-${entry.kind}` };
    if (entry.kind === 'duration')
        return (
            <div {...props}>
                <span className="muted">✻ Worked for {duration(entry.durationMs)}</span>
            </div>
        );
    if (entry.kind === 'compaction')
        return (
            <section {...props}>
                <div className="compaction-heading">
                    <span className="rule" />
                    <span> Conversation compacted </span>
                    <span className="rule" />
                </div>
                <div className="result-line">
                    <span className="result-marker">⎿</span>
                    <span className="muted">
                        {entry.summary ? 'Context summarized' : 'Compaction boundary'}
                    </span>
                </div>
            </section>
        );
    if (entry.kind === 'tool') {
        const label = toolLabel(entry),
            result = entry.result,
            resultLines = (result?.text || '').split('\n');
        const isEdit =
            entry.name === 'Edit' &&
            entry.input.old_string !== undefined &&
            entry.input.new_string !== undefined;
        return (
            <section {...props}>
                <div className="message-line">
                    <span
                        className={`bullet ${result ? (result.isError ? 'error' : 'success') : 'muted'}`}
                    >
                        ●
                    </span>
                    <div className="message-body">
                        <span className="tool-heading">
                            <strong>{entry.name}</strong>
                            <span>({label.length > 180 ? `${label.slice(0, 180)}…` : label})</span>
                        </span>
                    </div>
                </div>
                <div className={`result-line ${result?.isError ? 'error' : ''}`}>
                    <span className="result-marker">⎿</span>
                    <div className="result-body">
                        {isEdit && result && !result.isError ? (
                            <>
                                <span className="muted">
                                    Updated{' '}
                                    {String(entry.input.file_path || 'file')
                                        .split('/')
                                        .at(-1)}
                                </span>
                                <Diff input={entry.input} />
                            </>
                        ) : result ? (
                            <>
                                <pre>{resultLines.slice(0, 3).join('\n')}</pre>
                                {resultLines.length > 3 && (
                                    <span className="muted">… +{resultLines.length - 3} lines</span>
                                )}
                                {result.images?.length > 0 && (
                                    <span className="muted">
                                        {' '}
                                        [{result.images.length} image attachment
                                        {result.images.length === 1 ? '' : 's'}]
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="muted">No result saved in this file</span>
                        )}
                        {entry.orphan && (
                            <div className="muted">
                                Original tool call is not present in this file.
                            </div>
                        )}
                    </div>
                </div>
            </section>
        );
    }
    if (entry.kind === 'image')
        return (
            <section {...props}>
                <div className="message-line">
                    <span className="prompt">❯</span>
                    <span className="muted">[Image attachment]</span>
                </div>
            </section>
        );
    return (
        <section {...props}>
            <div className={`message-line ${entry.error ? 'error' : ''}`}>
                <span className={entry.kind === 'user' ? 'prompt' : 'bullet'}>
                    {entry.kind === 'user' ? '❯' : entry.kind === 'notice' ? '⎿' : '●'}
                </span>
                <div className="message-body">
                    {entry.kind === 'assistant' ? (
                        <RichText text={entry.text} />
                    ) : (
                        <pre>{entry.text}</pre>
                    )}
                </div>
            </div>
        </section>
    );
}
