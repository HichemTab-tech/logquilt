import { useEffect, useRef } from 'react';
import { getMatchExcerpt } from './search.ts';
import type { SearchMatch } from './search.ts';

interface Props {
    query: string;
    pending: boolean;
    count: number;
    position: number;
    match: SearchMatch | undefined;
    onQueryChange: (query: string) => void;
    onNavigate: (direction: -1 | 1) => void;
}

export default function TranscriptSearch({
    query,
    pending,
    count,
    position,
    match,
    onQueryChange,
    onNavigate,
}: Props) {
    const input = useRef<HTMLInputElement>(null);
    const preview = useRef<HTMLParagraphElement>(null);
    const excerpt = match ? getMatchExcerpt(match) : undefined;
    const status = pending
        ? 'Searching…'
        : query.trim()
          ? count
              ? `${position + 1} of ${count} results`
              : 'No results'
          : '';

    useEffect(() => {
        const element = preview.current;
        const highlight = element?.querySelector('mark');
        if (element && highlight) {
            element.scrollTop = Math.max(0, highlight.offsetTop - element.clientHeight / 2);
        }
    }, [match]);

    return (
        <div className="transcript-search" role="search" aria-label="Conversation search">
            <div className="search-controls">
                <label className="search-field">
                    <span aria-hidden="true">⌕</span>
                    <input
                        ref={input}
                        type="search"
                        aria-label="Search conversation"
                        aria-describedby="search-status"
                        placeholder="Search conversation…"
                        value={query}
                        maxLength={512}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => onQueryChange(event.target.value)}
                    />
                </label>
                <output
                    id="search-status"
                    className="search-count"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {status}
                </output>
                <div className="search-actions">
                    <button
                        type="button"
                        aria-label="Previous result"
                        title="Previous result"
                        disabled={pending || !count}
                        onClick={() => onNavigate(-1)}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        aria-label="Next result"
                        title="Next result"
                        disabled={pending || !count}
                        onClick={() => onNavigate(1)}
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        aria-label="Clear search"
                        disabled={!query}
                        onClick={() => {
                            onQueryChange('');
                            input.current?.focus();
                        }}
                    >
                        Clear
                    </button>
                </div>
            </div>
            {match && excerpt && (
                <div className="search-preview" aria-label="Selected search result">
                    <span className="search-source">{match.source}</span>
                    <p ref={preview}>
                        {excerpt.leadingEllipsis && '…'}
                        {excerpt.before}
                        <mark>{excerpt.match}</mark>
                        {excerpt.after}
                        {excerpt.trailingEllipsis && '…'}
                    </p>
                </div>
            )}
        </div>
    );
}
