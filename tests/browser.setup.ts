import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { createViewerServer } from '../server.ts';
import { listen, closeServer } from './server.helpers.ts';

declare module 'vitest' {
    export interface ProvidedContext {
        baseUrl: string;
    }
}

export default async function setup(project: TestProject) {
    await promisify(execFile)('pnpm', ['build'], {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
    });
    const server = await createViewerServer();
    project.provide('baseUrl', await listen(server));
    return () => closeServer(server);
}
