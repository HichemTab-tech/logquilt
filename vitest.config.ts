import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    environment: 'node',
                    include: ['tests/*.test.ts'],
                },
            },
            {
                test: {
                    name: 'browser',
                    environment: 'node',
                    include: ['tests/*.spec.ts'],
                    globalSetup: ['tests/browser.setup.ts'],
                    testTimeout: 30000,
                    hookTimeout: 30000,
                    expect: { poll: { timeout: 5000 } },
                },
            },
        ],
    },
});
