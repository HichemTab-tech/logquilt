import { expect, test } from 'vitest';
import { parseTranscript } from '../src/transcript.ts';
import { indexTranscript, findMatches, getMatchExcerpt } from '../src/search.ts';
import { fixture } from './fixture.ts';

const index = indexTranscript(parseTranscript(fixture()).entries);

test('searches message text case-insensitively and ignores empty queries', () => {
    expect(findMatches(index, 'TEST SUITE')[0]?.source).toBe('Message');
    expect(findMatches(index, '').length).toBe(0);
    expect(findMatches(index, '   ').length).toBe(0);
    expect(findMatches(index, 'not-in-this-conversation').length).toBe(0);
});

test('finds full tool arguments, collapsed results, and compaction summaries', () => {
    expect(findMatches(index, 'Run the test suite')[0]?.source).toBe('Tool input');
    expect(findMatches(index, 'secret-search-target')[0]?.source).toBe('Tool output');
    expect(findMatches(index, 'return "Hello, world!";')[0]?.source).toBe('Tool input');
    expect(findMatches(index, 'previous conversation updated')[0]?.source).toBe(
        'Compaction summary',
    );
});

test('returns one result per entry in transcript order', () => {
    const matches = findMatches(index, 'greeting');
    const indices = matches.map((match) => match.entryIndex);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(matches.length);
    expect(matches.length).toBeGreaterThan(3);
});

test('searches literal code in nested tool inputs and preserves readable row indices', () => {
    const { entries } = parseTranscript(
        JSON.stringify({
            type: 'assistant',
            uuid: 'nested',
            message: {
                content: [
                    { type: 'thinking', thinking: 'Internal reasoning' },
                    {
                        type: 'tool_use',
                        id: 'edit',
                        name: 'MultiEdit',
                        input: {
                            edits: [{ old_string: 'before', new_string: 'after "quoted code"' }],
                        },
                    },
                ],
            },
        }),
    );
    const readable = entries.filter((entry) => entry.kind !== 'thinking');
    const [match] = findMatches(indexTranscript(readable), 'after "quoted code"');
    expect(match.entryIndex).toBe(0);
    expect(match.source).toBe('Tool input');
    expect(getMatchExcerpt(match).match).toBe('after "quoted code"');
});

test('matches punctuation literally and preserves offsets after Unicode text', () => {
    const { entries } = parseTranscript(
        JSON.stringify({
            type: 'user',
            uuid: 'literal',
            message: { content: 'İ prefix [value].* suffix' },
        }),
    );
    const [match] = findMatches(indexTranscript(entries), ' [VALUE].* ');
    expect(getMatchExcerpt(match)).toMatchObject({
        before: 'İ prefix ',
        match: '[value].*',
        after: ' suffix',
    });
});

test('produces a short excerpt even for a match near the end of a long entry', () => {
    const text = `${'x'.repeat(100000)} needle ${'y'.repeat(100000)}`;
    const { entries } = parseTranscript(
        JSON.stringify({
            type: 'assistant',
            uuid: 'long',
            message: { content: text },
        }),
    );
    const excerpt = getMatchExcerpt(findMatches(indexTranscript(entries), 'needle')[0]);
    expect(excerpt.match).toBe('needle');
    expect(excerpt.before.length).toBeLessThanOrEqual(80);
    expect(excerpt.after.length).toBeLessThanOrEqual(80);
    expect(excerpt.leadingEllipsis).toBe(true);
    expect(excerpt.trailingEllipsis).toBe(true);
});
