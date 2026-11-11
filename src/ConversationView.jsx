import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import TranscriptRow, { modelName } from './TranscriptRow.jsx';
import BrandMark from './BrandMark.jsx';
import CreatorCredit from './CreatorCredit.jsx';

export default function ConversationView({ conversation, error, onHome }) {
  const { data, name } = conversation;
  const scroller = useRef(null);
  const entries = useMemo(() => data.entries.filter(entry => entry.kind !== 'thinking'), [data]);
  const virtual = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scroller.current,
    estimateSize: index => entries[index]?.kind === 'tool' ? 100 : 90,
    overscan: 10,
    getItemKey: index => entries[index].id,
  });
  const metadata = data.metadata;

  return <div className="terminal">
    <header className="terminal-heading">
      <BrandMark className="viewer-brand-mark" size={48} />
      <div className="identity">
        <div><strong>Logquilt</strong> <span className="muted">transcript viewer</span></div>
        <div className="muted">{metadata.model ? modelName(metadata.model) : 'Conversation viewer'}</div>
        <div className="cwd muted" title={metadata.cwd}>{metadata.cwd || name}</div>
      </div>
      <button className="back-home" aria-label="Back to home" onClick={onHome}><span aria-hidden="true">←</span> Home</button>
    </header>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {data.warnings.length > 0 && <div className="warning-banner">{data.warnings.length} unreadable line{data.warnings.length === 1 ? '' : 's'} skipped.</div>}
    <main ref={scroller} className="transcript-scroll" tabIndex={0} aria-label="Conversation transcript" data-filename={name}>
      <div className="virtual-transcript" style={{ height: `${virtual.getTotalSize()}px` }}>
        {virtual.getVirtualItems().map(item => <div key={item.key} data-index={item.index} ref={virtual.measureElement}
          className="virtual-row" style={{ transform: `translateY(${item.start}px)` }}>
          <TranscriptRow entry={entries[item.index]} />
        </div>)}
      </div>
    </main>
    <footer className="terminal-footer" aria-label="End of read-only transcript">
      <div className="static-prompt"><span className="prompt">❯</span><span className="cursor" aria-hidden="true" /></div>
      <div className="viewer-credit"><CreatorCredit /></div>
    </footer>
  </div>;
}
