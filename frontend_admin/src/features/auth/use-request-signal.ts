import { useEffect, useRef } from 'react';

// A completed transport must never navigate or publish form state after leaving its screen.
export function useRequestSignal() {
    const current = useRef<AbortController | null>(null);
    useEffect(() => () => current.current?.abort(), []);
    return () => {
        current.current?.abort();
        current.current = new AbortController();
        return current.current.signal;
    };
}
