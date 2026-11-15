import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import TranscriptRow, { modelName } from './TranscriptRow.tsx';
import BrandMark from './BrandMark.tsx';
import CreatorCredit from './CreatorCredit.tsx';
import TranscriptSearch from './TranscriptSearch.tsx';
import { indexTranscript, findMatches } from './search.ts';

import type { Conversation } from './types.ts';

interface Props {
    conversation: Conversation;
    error: string;
    onHome: () => void;
}

export default function ConversationView({ conversation, error, onHome }: Props) {
    const { data, name } = conversation;
    const scroller = useRef<HTMLElement>(null);
    const [query, setQuery] = useState('');
    const [resultIndex, setResultIndex] = useState(0);
    const deferredQuery = useDeferredValue(query.trim());
    const pending = deferredQuery !== query.trim();
    const entries = useMemo(
        () => data.entries.filter((entry) => entry.kind !== 'thinking'),
        [data],
    );
    const searchIndex = useMemo(() => indexTranscript(entries), [entries]);
    const matches = useMemo(
        () => findMatches(searchIndex, deferredQuery),
        [searchIndex, deferredQuery],
    );
    const position = matches.length ? Math.min(resultIndex, matches.length - 1) : 0;
    const activeMatch = pending ? undefined : matches[position];
    const virtual = useVirtualizer({
        count: entries.length,
        getScrollElement: () => scroller.current,
        estimateSize: (index) => (entries[index]?.kind === 'tool' ? 100 : 90),
        overscan: 10,
        getItemKey: (index) => entries[index].id,
    });
    const metadata = data.metadata;

    useEffect(() => {
        if (activeMatch) virtual.scrollToIndex(activeMatch.entryIndex, { align: 'start' });
    }, [activeMatch, virtual]);

    return (
        <div className="terminal">
            <header className="terminal-heading">
                <BrandMark className="viewer-brand-mark" size={48} />
                <div className="identity">
                    <div>
                        <strong>Logquilt</strong> <span className="muted">transcript viewer</span>
                    </div>
                    <div className="muted">
                        {metadata.model ? modelName(metadata.model) : 'Conversation viewer'}
                    </div>
                    <div className="cwd muted" title={metadata.cwd}>
                        {metadata.cwd || name}
                    </div>
                </div>
                <button className="back-home" aria-label="Back to home" onClick={onHome}>
                    <span aria-hidden="true">←</span> Home
                </button>
            </header>
            <TranscriptSearch
                query={query}
                pending={pending}
                count={matches.length}
                position={position}
                match={activeMatch}
                onQueryChange={(value) => {
                    setQuery(value);
                    setResultIndex(0);
                }}
                onNavigate={(direction) => {
                    if (!pending && matches.length) {
                        const next = (position + direction + matches.length) % matches.length;
                        setResultIndex(next);
                        // Also jump when a single result is already selected but scrolled away.
                        virtual.scrollToIndex(matches[next].entryIndex, { align: 'start' });
                    }
                }}
            />
            {error && (
                <div className="error-banner" role="alert">
                    {error}
                </div>
            )}
            {data.warnings.length > 0 && (
                <div className="warning-banner">
                    {data.warnings.length} unreadable line{data.warnings.length === 1 ? '' : 's'}{' '}
                    skipped.
                </div>
            )}
            <main
                ref={scroller}
                className="transcript-scroll"
                tabIndex={0}
                aria-label="Conversation transcript"
                data-filename={name}
            >
                <div
                    className="virtual-transcript"
                    style={{ height: `${virtual.getTotalSize()}px` }}
                >
                    {virtual.getVirtualItems().map((item) => (
                        <div
                            key={item.key}
                            data-index={item.index}
                            data-search-active={activeMatch?.entryIndex === item.index || undefined}
                            aria-current={activeMatch?.entryIndex === item.index || undefined}
                            ref={virtual.measureElement}
                            className="virtual-row"
                            style={{ transform: `translateY(${item.start}px)` }}
                        >
                            <TranscriptRow entry={entries[item.index]} />
                        </div>
                    ))}
                </div>
            </main>
            <footer className="terminal-footer" aria-label="End of read-only transcript">
                <div className="static-prompt">
                    <span className="prompt">❯</span>
                    <span className="cursor" aria-hidden="true" />
                </div>
                <div className="viewer-credit">
                    <CreatorCredit />
                </div>
            </footer>
        </div>
    );
}
