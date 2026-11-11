import { parseTranscript } from './transcript.ts';
import type { ParseRequest, ParseResponse } from './types.ts';

const worker: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const send = (message: ParseResponse) => worker.postMessage(message);

worker.onmessage = async ({ data }: MessageEvent<ParseRequest>) => {
    try {
        if (data.type === 'parse') {
            const text = await data.file.text();
            const transcript = parseTranscript(text, (progress) =>
                send({ type: 'progress', progress }),
            );
            send({ type: 'parsed', transcript });
        }
    } catch {
        send({
            type: 'error',
            message: 'Could not read this transcript. Choose a UTF-8 Claude Code JSONL file.',
        });
    }
};
