import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { get } from 'node:http';
import { listen, closeServer } from './server.helpers.ts';
import { createViewerServer } from '../server.ts';

test('serves public assets and rejects transcript files and cross-origin access', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'viewer-test-'));
    await writeFile(join(dir, 'session.jsonl'), '{"type":"user"}\n');
    await writeFile(join(dir, 'index.html'), '<title>Viewer</title>');
    const server = await createViewerServer({ root: dir });
    const url = await listen(server);
    try {
        assert.equal((await fetch(url + '/api/session')).status, 404);
        assert.equal((await fetch(url + '/api/transcript')).status, 404);
        assert.equal(
            (await fetch(url + '/api/transcript', { headers: { Origin: 'https://evil.example' } }))
                .status,
            403,
        );
        // Node's fetch rewrites Host; use a real HTTP request for the rebinding check.
        assert.equal(
            await new Promise((resolve, reject) =>
                get(url + '/api/transcript', { headers: { Host: 'evil.example' } }, (res) => {
                    res.resume();
                    resolve(res.statusCode);
                }).on('error', reject),
            ),
            403,
        );
        assert.equal((await fetch(url + '/api/transcript', { method: 'POST' })).status, 405);
        assert.equal((await fetch(url + '/%2e%2e%2fpackage.json')).status, 404);
        assert.equal((await fetch(url + '/session.jsonl')).status, 404);
        assert.equal((await fetch(url + '/')).status, 200);
    } finally {
        await closeServer(server);
        await rm(dir, { recursive: true, force: true });
    }
});

test('removed example endpoints never expose files or session metadata', async () => {
    const server = await createViewerServer({ root: '/nonexistent' });
    const url = await listen(server);
    try {
        assert.equal((await fetch(url + '/api/session')).status, 404);
        assert.equal((await fetch(url + '/api/transcript?path=/etc/passwd')).status, 404);
    } finally {
        await closeServer(server);
    }
});
