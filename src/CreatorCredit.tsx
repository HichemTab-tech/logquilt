import React from 'react';
import { site } from '../site.config.ts';

export default function CreatorCredit() {
    return (
        <span className="creator-credit">
            Built by{' '}
            <a href={site.author.url} target="_blank" rel="author noopener noreferrer">
                {site.author.name}
            </a>
        </span>
    );
}
