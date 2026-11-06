'use client';

import { useRef } from 'react';

export function useStableCommandKey() {
    const current = useRef<{ fingerprint: string; key: string } | null>(null);
    return {
        forIntent(fingerprint: string) {
            if (current.current?.fingerprint !== fingerprint)
                current.current = { fingerprint, key: crypto.randomUUID() };
            return current.current.key;
        },
        reset() {
            current.current = null;
        },
    };
}
