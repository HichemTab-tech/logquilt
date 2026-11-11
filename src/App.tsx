import React, { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import HomePage from './HomePage.tsx';
import ConversationView from './ConversationView.tsx';
import { site } from '../site.config.ts';

import type { Conversation, ParseRequest, ParseResponse } from './types.ts';
type View = 'home' | 'conversation';

const MAX_FILE_SIZE = 512 * 1024 * 1024;

export default function App() {
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [view, setView] = useState<View>('home');
    const [loading, setLoading] = useState<{ name: string; label: string } | null>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const worker = useRef<Worker | null>(null);
    const loadId = useRef(0);
    const dragDepth = useRef(0);
    const currentConversation = useRef<Conversation | null>(null);
    currentConversation.current = conversation;

    const navigate = useCallback((nextView: View) => {
        const hash = nextView === 'conversation' ? '#conversation' : '';
        if (window.location.hash !== hash) {
            window.history.pushState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${hash}`,
            );
        }
        setView(nextView);
        setError('');
    }, []);

    useEffect(() => {
        // Uploaded files exist only in this tab's memory, so a fresh page starts at home.
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${window.location.search}`,
        );
        const onPopState = () => {
            setView(
                window.location.hash === '#conversation' && currentConversation.current
                    ? 'conversation'
                    : 'home',
            );
            setError('');
        };
        window.addEventListener('popstate', onPopState);
        return () => {
            worker.current?.terminate();
            window.removeEventListener('popstate', onPopState);
        };
    }, []);

    useEffect(() => {
        document.title =
            view === 'conversation' && conversation
                ? `${conversation.name} · Logquilt`
                : site.title;
        document
            .querySelector('meta[name="robots"]')
            ?.setAttribute('content', view === 'conversation' ? 'noindex, nofollow' : site.robots);
    }, [view, conversation]);

    const cancelLoad = useCallback(() => {
        loadId.current++;
        worker.current?.terminate();
        worker.current = null;
        setLoading(null);
        setProgress(0);
    }, []);

    const beginLoad = useCallback(
        (name: string) => {
            cancelLoad();
            setError('');
            setLoading({ name, label: 'Opening conversation' });
            return loadId.current;
        },
        [cancelLoad],
    );

    const parseFile = useCallback(
        (file: Blob, name: string, id: number) => {
            if (id !== loadId.current) return;
            if (file.size > MAX_FILE_SIZE) {
                setLoading(null);
                setError('This file is larger than 512 MB. Choose a smaller transcript.');
                return;
            }
            const next = new Worker(new URL('./parser.worker.ts', import.meta.url), {
                type: 'module',
            });
            worker.current = next;
            setLoading({ name, label: 'Reading conversation' });
            next.onmessage = ({ data: message }: MessageEvent<ParseResponse>) => {
                if (id !== loadId.current) return;
                if (message.type === 'progress') setProgress(message.progress);
                if (message.type === 'parsed' || message.type === 'error') {
                    next.terminate();
                    worker.current = null;
                    setLoading(null);
                }
                if (message.type === 'parsed') {
                    if (!message.transcript.entries.length) {
                        setError(
                            'No conversation messages found. Choose a Claude Code JSONL file.',
                        );
                        return;
                    }
                    setConversation({ id, name, size: file.size, data: message.transcript });
                    navigate('conversation');
                }
                if (message.type === 'error') setError(message.message);
            };
            next.onerror = () => {
                if (id !== loadId.current) return;
                next.terminate();
                worker.current = null;
                setLoading(null);
                setError('The file could not be processed. Try another JSONL file.');
            };
            next.postMessage({ type: 'parse', file } satisfies ParseRequest);
        },
        [navigate],
    );

    const openFile = useCallback(
        (file: File | undefined) => {
            if (!file) return;
            const id = beginLoad(file.name);
            if (!/\.(jsonl|ndjson)$/i.test(file.name)) {
                setLoading(null);
                setError('Choose a .jsonl or .ndjson conversation file.');
                return;
            }
            parseFile(file, file.name, id);
        },
        [beginLoad, parseFile],
    );

    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (!event.dataTransfer.files.length) return;
        if (event.dataTransfer.files.length > 1) {
            cancelLoad();
            setError('Choose one conversation at a time.');
            return;
        }
        openFile(event.dataTransfer.files[0]);
    };

    return (
        <div
            className={`app ${view === 'home' ? 'app-home' : ''}`}
            onDragEnter={(event) => {
                event.preventDefault();
                if (event.dataTransfer.types.includes('Files')) {
                    dragDepth.current++;
                    setDragging(true);
                }
            }}
            onDragLeave={() => {
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (!dragDepth.current) setDragging(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
        >
            <input
                ref={fileInput}
                type="file"
                accept=".jsonl,.ndjson"
                hidden
                onChange={(event) => {
                    openFile(event.target.files?.[0]);
                    event.target.value = '';
                }}
            />
            {view === 'home' || !conversation ? (
                <HomePage
                    error={error}
                    conversation={conversation}
                    onUpload={() => fileInput.current?.click()}
                    onResume={() => navigate('conversation')}
                />
            ) : (
                <ConversationView
                    key={conversation.id}
                    conversation={conversation}
                    error={error}
                    onHome={() => navigate('home')}
                />
            )}
            {loading && (
                <div
                    className="loading-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Opening conversation"
                >
                    <div className="loading-card">
                        <div role="status">
                            <span className="spinner" aria-hidden="true">
                                ◌
                            </span>{' '}
                            {loading.label}… <span className="muted">{progress}%</span>
                        </div>
                        <p className="loading-filename muted">{loading.name}</p>
                        <div className="loading-track">
                            <div style={{ width: `${Math.max(3, progress)}%` }} />
                        </div>
                        <button className="cancel-load" onClick={cancelLoad} autoFocus>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {dragging && (
                <div className="drop-overlay" aria-hidden="true">
                    <span>↓</span> Drop your Claude Code JSONL here
                </div>
            )}
        </div>
    );
}
