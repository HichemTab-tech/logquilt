export function fixture() {
    const r = (
        type: string,
        uuid: string,
        content: unknown,
        extra: Record<string, unknown> = {},
    ) => ({
        type,
        uuid,
        timestamp: '2026-11-11T10:30:00Z',
        version: '2.1.308',
        cwd: '/projects/example',
        sessionId: 'example-session',
        message: { model: type === 'assistant' ? 'claude-opus-4-6' : undefined, content },
        ...extra,
    });
    return [
        r('user', 'u1', 'Can you check the test suite and update the greeting?'),
        r('assistant', 'a1', [
            { type: 'thinking', thinking: 'A hidden thought about the greeting.' },
            { type: 'text', text: 'I’ll run the tests, then update the greeting.' },
        ]),
        r('assistant', 'a2', [
            {
                type: 'tool_use',
                id: 't1',
                name: 'Bash',
                input: { command: 'npm test', description: 'Run the test suite' },
            },
        ]),
        r('user', 'u2', [
            {
                type: 'tool_result',
                tool_use_id: 't1',
                content:
                    '> project@1.0.0 test\n> node --test\n\n✔ greeting\n✔ formatting\n8 tests passed\nsecret-search-target',
            },
        ]),
        r('assistant', 'a3', [
            {
                type: 'tool_use',
                id: 't2',
                name: 'Edit',
                input: {
                    file_path: '/projects/example/src/greeting.js',
                    old_string: 'return "Hello";',
                    new_string: 'return "Hello, world!";',
                },
            },
        ]),
        r('user', 'u3', [
            { type: 'tool_result', tool_use_id: 't2', content: 'Updated greeting.js.' },
        ]),
        r('assistant', 'a4', [
            {
                type: 'text',
                text: 'Updated **greeting.js**. All eight tests pass.\n\n- Preserved the existing API\n- Added the greeting\n\n```js\nconsole.log("Hello, world!");\n```',
            },
        ]),
        { type: 'system', uuid: 'd', subtype: 'turn_duration', durationMs: 64000 },
        {
            type: 'system',
            uuid: 'b',
            subtype: 'compact_boundary',
            content: 'Conversation compacted',
            compactMetadata: { trigger: 'auto', preTokens: 160000, postTokens: 12000 },
        },
        r('user', 's', 'The previous conversation updated a greeting and verified eight tests.', {
            isCompactSummary: true,
            isVisibleInTranscriptOnly: true,
        }),
        r('user', 'u4', 'Show me the next steps.'),
        r('assistant', 'a5', [
            { type: 'text', text: 'Everything is ready. You can review the change.' },
        ]),
    ]
        .map((r) => JSON.stringify(r))
        .join('\n');
}
