import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscript } from '../src/transcript.mjs';

const lines = (...records) => records.map(r => typeof r === 'string' ? r : JSON.stringify(r)).join('\n');
const msg = (type, uuid, content, rest = {}) => ({ type, uuid, timestamp: '2026-11-11T12:00:00Z', message: { content }, ...rest });

test('pairs tool calls with results even when results arrive before calls', () => {
  const data = parseTranscript(lines(
    msg('user', 'u', [{type:'tool_result',tool_use_id:'t',content:[{type:'text',text:'hello\nworld'}]}]),
    msg('assistant', 'a', [{type:'tool_use',id:'t',name:'Bash',input:{command:'printf hello'}}]),
  ));
  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0].kind, 'tool');
  assert.equal(data.entries[0].result.text, 'hello\nworld');
  assert.equal(data.entries[0].input.command, 'printf hello');
});

test('retains history across compactions and associates summaries', () => {
  const {entries, stats} = parseTranscript(lines(
    msg('user','u','Earlier question'),
    {type:'system',subtype:'compact_boundary',uuid:'b',content:'Conversation compacted',compactMetadata:{trigger:'auto',preTokens:100000}},
    msg('user','s','Earlier work was summarized.',{isCompactSummary:true,isVisibleInTranscriptOnly:true}),
    msg('assistant','a',[{type:'text',text:'Continuing.'}]),
  ));
  assert.deepEqual(entries.map(e=>e.kind), ['user','compaction','assistant']);
  assert.equal(entries[1].summary, 'Earlier work was summarized.');
  assert.equal(entries[2].segment, 1);
  assert.equal(stats.compactions, 1);
});

test('deduplicates records and excludes API payloads, metadata, and sidechains', () => {
  const record = msg('assistant','a',[{type:'text',text:'one answer'}]);
  const {entries, stats} = parseTranscript(lines(record,record,
    {type:'api-request-blob',message:record.message},
    msg('user','meta','system instructions',{isMeta:true}),
    msg('assistant','side',[{type:'text',text:'side answer'}],{isSidechain:true}),
    {type:'attachment',attachment:{type:'environment',content:'injected context'}},
  ));
  assert.equal(entries.length, 1);
  assert.equal(stats.duplicates, 1);
});

test('survives malformed lines, null values and a partial final record', () => {
  const {entries,warnings} = parseTranscript('\uFEFF'+lines('null','not json',msg('user','a','valid'),'{"type":'));
  assert.equal(entries[0].text, 'valid');
  assert.equal(warnings.length, 3);
  assert.equal(warnings[1].line, 2);
  assert.ok(!JSON.stringify(warnings).includes('not json'));
});

test('keeps text beside tool results and records unmatched results visibly', () => {
  const {entries} = parseTranscript(lines(msg('user','a',[
    {type:'tool_result',tool_use_id:'missing',content:'orphan output',is_error:true},
    {type:'text',text:'actual user follow-up'},
    {type:'image',source:{type:'base64',media_type:'image/png',data:'AA=='}},
  ])));
  assert.ok(entries.some(e=>e.kind==='tool' && e.result.text==='orphan output' && e.result.isError));
  assert.ok(entries.some(e=>e.kind==='user' && e.text==='actual user follow-up'));
  assert.ok(entries.some(e=>e.kind==='image'));
});

test('merges streamed assistant text fragments sharing a message ID without dropping tools', () => {
  const {entries} = parseTranscript(lines(
    {type:'assistant',uuid:'a',message:{id:'m',content:[{type:'text',text:'first'}]}},
    {type:'assistant',uuid:'b',message:{id:'m',content:[{type:'text',text:'second'}]}},
    {type:'assistant',uuid:'c',message:{id:'m',content:[{type:'tool_use',id:'t',name:'Read',input:{file_path:'a.txt'}}]}},
  ));
  assert.equal(entries[0].text, 'first\n\nsecond');
  assert.equal(entries[1].kind, 'tool');
});

test('does not count tool-result envelopes as human prompts', () => {
  const {stats} = parseTranscript(lines(msg('user','a','hi'),msg('user','b',[{type:'tool_result',tool_use_id:'x',content:'done'}])));
  assert.equal(stats.prompts,1);
});

test('keeps orphan tool output in its original position and compaction segment', () => {
  const {entries}=parseTranscript(lines(
    msg('user','r',[{type:'tool_result',tool_use_id:'missing',content:'earlier output'}]),
    msg('user','u','Later question'),
    {type:'system',uuid:'b',subtype:'compact_boundary'},
    msg('assistant','a',[{type:'text',text:'Later answer'}]),
  ));
  assert.deepEqual(entries.map(e=>e.kind),['tool','user','compaction','assistant']);
  assert.equal(entries[0].segment,0);
  assert.equal(entries[3].segment,1);
});

test('results arriving before multiple calls do not create duplicate entry IDs', () => {
  const {entries}=parseTranscript(lines(
    msg('user','r',[{type:'tool_result',tool_use_id:'t1',content:'one'},{type:'tool_result',tool_use_id:'t2',content:'two'}]),
    msg('assistant','a',[{type:'tool_use',id:'t1',name:'Read',input:{}},{type:'tool_use',id:'t2',name:'Read',input:{}}]),
  ));
  assert.equal(entries.length,2);
  assert.equal(new Set(entries.map(e=>e.id)).size,2);
  assert.deepEqual(entries.map(e=>e.result.text),['one','two']);
});
