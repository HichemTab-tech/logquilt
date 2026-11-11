const ANSI = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g;
export const cleanText = value => String(value ?? '').replace(ANSI, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

export function contentText(content) {
  if (typeof content === 'string') return cleanText(content);
  if (!Array.isArray(content)) return content == null ? '' : cleanText(JSON.stringify(content, null, 2));
  return content.map(block => {
    if (!block || typeof block !== 'object') return '';
    if (block.type === 'text') return cleanText(block.text);
    if (block.type === 'image') return '[Image]';
    if (block.type === 'tool_reference') return `[Tool: ${cleanText(block.tool_name)}]`;
    if (block.type === 'resource') return cleanText(block.resource?.text ?? block.resource?.uri);
    return '';
  }).filter(Boolean).join('\n');
}

export function parseTranscript(text, onProgress = () => {}) {
  const entries = [], warnings = [], seen = new Set(), tools = new Map(), pending = new Map();
  const metadata = { name: '', sessionId: '', cwd: '', version: '', model: '', started: '', ended: '' };
  const stats = { records: 0, prompts: 0, tools: 0, compactions: 0, duplicates: 0, ignored: 0 };
  let segment = 0, entrySequence = 0, lastBoundary;
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  const add = (record, line, entry) => {
    const item = { id: `${record.uuid || `line-${line}`}:${entrySequence++}`, timestamp: record.timestamp || '', segment, ...entry };
    entries.push(item);
    return item;
  };
  const addResult = (id, result, record, line) => {
    if (tools.has(id)) tools.get(id).result = result;
    else if (pending.has(id)) pending.get(id).result = result;
    else pending.set(id, add(record, line, { kind: 'tool', name: 'Tool result', input: {}, toolId: id, result, orphan: true }));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let record;
    try { record = JSON.parse(line); }
    catch { warnings.push({ line: i + 1, message: 'Invalid JSON; this line was skipped.' }); continue; }
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      warnings.push({ line: i + 1, message: 'Expected a JSON object; this line was skipped.' }); continue;
    }
    stats.records++;
    if (record.uuid && seen.has(record.uuid)) { stats.duplicates++; continue; }
    if (record.uuid) seen.add(record.uuid);
    if (record.isSidechain) { stats.ignored++; continue; }
    if (i % 300 === 0) onProgress(Math.round(i / lines.length * 100));

    if (record.type === 'custom-title') metadata.name = cleanText(record.customTitle);
    for (const [from, to] of [['sessionId','sessionId'],['cwd','cwd'],['version','version']]) {
      if (typeof record[from] === 'string') metadata[to] = cleanText(record[from]);
    }
    if (record.timestamp) {
      metadata.started ||= record.timestamp;
      metadata.ended = record.timestamp;
    }
    if (record.type === 'system') {
      if (record.subtype === 'compact_boundary') {
        segment++;
        stats.compactions++;
        const cm = record.compactMetadata || {};
        lastBoundary = add(record, i, { kind: 'compaction', text: 'Conversation compacted', summary: '', trigger: cm.trigger || 'auto', preTokens: cm.preTokens, postTokens: cm.postTokens });
      } else if (record.subtype === 'turn_duration' && record.durationMs > 0) {
        add(record, i, { kind: 'duration', text: '', durationMs: record.durationMs });
      } else if (record.subtype === 'local_command' || record.level === 'error' || record.level === 'warning') {
        const value = contentText(record.content);
        if (value) add(record, i, { kind: 'notice', text: value, error: record.level === 'error' });
      }
      continue;
    }
    if (record.type !== 'user' && record.type !== 'assistant') { stats.ignored++; continue; }
    const message = record.message;
    if (!message || typeof message !== 'object') continue;
    if (message.model && message.model !== '<synthetic>') metadata.model = cleanText(message.model);
    if (record.isCompactSummary) {
      const summary = contentText(message.content);
      if (lastBoundary) lastBoundary.summary += (lastBoundary.summary ? '\n\n' : '') + summary;
      else {
        segment++; stats.compactions++;
        lastBoundary = add(record, i, { kind: 'compaction', text: 'Conversation summary', summary });
      }
      continue;
    }
    if (record.isMeta) { stats.ignored++; continue; }
    const blocks = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content;
    if (!Array.isArray(blocks)) continue;
    let isPrompt = false;
    for (const [index, block] of blocks.entries()) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'tool_result') {
        addResult(block.tool_use_id || `${record.uuid}:${index}`, { text: contentText(block.content), isError: !!block.is_error, images: inlineImages(block.content) }, record, i);
      } else if (block.type === 'tool_use' || block.type === 'server_tool_use') {
        if (block.id && tools.has(block.id)) continue;
        const earlierResult = pending.get(block.id);
        if (earlierResult) entries.splice(entries.indexOf(earlierResult), 1);
        const tool = add(record, i, { kind: 'tool', name: cleanText(block.name || 'Tool'), input: block.input && typeof block.input === 'object' ? block.input : {}, toolId: block.id, model: message.model, result: pending.get(block.id)?.result || null });
        tools.set(block.id, tool); pending.delete(block.id); stats.tools++;
      } else if (block.type === 'thinking' && block.thinking) {
        add(record, i, { kind: 'thinking', text: cleanText(block.thinking), model: message.model });
      } else if (block.type === 'text' && block.text) {
        let value = cleanText(block.text);
        let kind = record.type;
        if (value.includes('<local-command-stdout>')) {
          value = value.replace(/<\/?local-command-stdout>/g, '').trim(); kind = 'notice';
        } else if (value.includes('<command-name>')) {
          const name = value.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1];
          const args = value.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1];
          if (name) value = [name, args].filter(Boolean).join(' ');
        }
        if (!value) continue;
        const prev = entries.at(-1);
        if (kind === 'assistant' && message.id && prev?.kind === kind && prev.messageId === message.id && prev.segment === segment) prev.text += '\n\n' + value;
        else add(record, i, { kind, text: value, messageId: message.id, model: message.model, error: !!record.isApiErrorMessage });
        if (kind === 'user') isPrompt = true;
      } else if (block.type === 'image') {
        const source = safeImage(block.source);
        add(record, i, { kind: 'image', text: source ? 'Image attachment' : 'Image attachment (not embedded in transcript)', source });
        if (record.type === 'user') isPrompt = true;
      } else if (block.type === 'redacted_thinking') {
        add(record, i, { kind: 'thinking', text: '[Thinking was not saved in this transcript.]' });
      }
    }
    if (isPrompt) stats.prompts++;
  }
  onProgress(100);
  return { entries, metadata, stats, warnings };
}

function safeImage(source) {
  if (source?.type !== 'base64' || !['image/png','image/jpeg','image/gif','image/webp'].includes(source.media_type) || typeof source.data !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(source.data)) return null;
  return `data:${source.media_type};base64,${source.data}`;
}
function inlineImages(content) {
  return Array.isArray(content) ? content.filter(b => b?.type === 'image').map(b => safeImage(b.source)).filter(Boolean) : [];
}

export function toolLabel(entry) {
  const input = entry.input || {};
  if (entry.name === 'Bash') return cleanText(input.command || input.description || '');
  if (['Read','Write','Edit','MultiEdit','NotebookEdit'].includes(entry.name)) return cleanText(input.file_path || input.notebook_path || '');
  if (entry.name === 'Grep' || entry.name === 'Glob') return cleanText(input.pattern || '');
  if (entry.name === 'Agent' || entry.name === 'Task') return cleanText(input.description || input.subagent_type || '');
  if (entry.name === 'WebFetch') return cleanText(input.url || '');
  if (entry.name === 'WebSearch' || entry.name === 'ToolSearch') return cleanText(input.query || '');
  if (entry.name === 'Skill') return cleanText(input.skill || '');
  return Object.entries(input).map(([key,value]) => `${key}: ${typeof value === 'string' ? cleanText(value) : JSON.stringify(value)}`).join(', ');
}
