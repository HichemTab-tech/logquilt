import React from 'react';

export default function BrandMark({
    className = '',
    size = 32,
}: {
    className?: string;
    size?: number;
}) {
    return (
        <svg
            className={`brand-mark ${className}`}
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M6 5v16a5 5 0 0 0 5 5h15" />
            <path d="M13 6h13M13 13h13M13 20h7" />
            <path d="M26 20v6" />
        </svg>
    );
}
