import { parseTranscript } from './transcript.mjs';
let transcript;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'parse') {
      const text = await data.file.text();
      transcript = parseTranscript(text, progress => self.postMessage({ type: 'progress', progress }));
      self.postMessage({ type: 'parsed', transcript });

    }
  } catch {
    self.postMessage({ type: 'error', message: 'Could not read this transcript. Choose a UTF-8 Claude Code JSONL file.' });
  }
};
