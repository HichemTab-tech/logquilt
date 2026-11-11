import React from 'react';
import BrandMark from './BrandMark.tsx';
import CreatorCredit from './CreatorCredit.tsx';

import type { Conversation } from './types.ts';

interface Props {
    error: string;
    conversation: Conversation | null;
    onUpload: () => void;
    onResume: () => void;
}

export default function HomePage({ error, conversation, onUpload, onResume }: Props) {
    return (
        <main className="home-page">
            <header className="home-brand">
                <BrandMark size={30} />
                <strong>Logquilt</strong>
                <span className="brand-divider">/</span>
                <span className="muted">transcripts</span>
            </header>
            <div className="home-content">
                <div className="home-eyebrow">
                    <span className="status-dot" /> LOCAL CONVERSATION VIEWER
                </div>
                <h1>
                    Your conversations,
                    <br />
                    <span>back in the terminal.</span>
                </h1>
                <p className="home-description">
                    Open a saved Claude Code conversation.
                    <br className="desktop-break" /> The familiar terminal view, ready to read and
                    scroll.
                </p>
                <section
                    className="upload-panel"
                    data-testid="drop-zone"
                    aria-label="Upload a conversation"
                >
                    <div className="upload-file-icon" aria-hidden="true">
                        <span>❯_</span>
                        <small>.jsonl</small>
                    </div>
                    <h2>Drop your conversation here</h2>
                    <p className="muted">or choose a file from your computer</p>
                    <button className="upload-button" onClick={onUpload}>
                        <span aria-hidden="true">↑</span> Upload JSONL
                    </button>
                    <span className="upload-limit">.jsonl or .ndjson · up to 512 MB</span>
                </section>
                {error && (
                    <div className="error-banner home-error" role="alert">
                        {error}
                    </div>
                )}
                <p className="privacy-note">
                    <span aria-hidden="true">○</span> Your files stay in your browser. Nothing is
                    uploaded to a server.
                </p>
                {conversation && (
                    <button className="conversation-card" onClick={onResume}>
                        <span className="card-symbol" aria-hidden="true">
                            ↳
                        </span>
                        <span className="card-content">
                            <strong>Continue reading</strong>
                            <span>{conversation.name}</span>
                        </span>
                        <span className="card-detail">
                            {conversation.data.stats.prompts} prompts
                        </span>
                        <span className="card-arrow" aria-hidden="true">
                            →
                        </span>
                    </button>
                )}
                <div className="find-files">
                    <span className="muted">Looking for your transcripts?</span>
                    <code>~/.claude/projects/</code>
                    <p>Each conversation is saved as a .jsonl file inside its project folder.</p>
                </div>
            </div>
            <footer className="home-footer">
                <CreatorCredit />
                <span>Independent viewer · No account needed</span>
            </footer>
        </main>
    );
}
