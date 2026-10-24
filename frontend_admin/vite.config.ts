import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export default defineConfig(({ command, mode, isPreview }) => {
    const env = loadEnv(mode, import.meta.dirname, 'VITE_');
    const apiMode =
        process.env.VITE_API_MODE ?? env.VITE_API_MODE ?? (command === 'serve' && !isPreview ? 'mock' : 'real');
    if (!['mock', 'real'].includes(apiMode)) throw new Error('VITE_API_MODE must be mock or real');
    if (apiMode === 'mock' && (command === 'build' || isPreview)) {
        throw new Error('Build and preview cannot enable browser mocks');
    }
    const backendEnv = loadEnv(mode, import.meta.dirname, 'BACKEND_');
    const backendOrigin = process.env.BACKEND_ORIGIN ?? backendEnv.BACKEND_ORIGIN ?? 'http://127.0.0.1:3001';
    const backendUrl = new URL(backendOrigin);
    if (
        !['http:', 'https:'].includes(backendUrl.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(backendUrl.hostname) ||
        backendUrl.username ||
        backendUrl.password ||
        backendUrl.pathname !== '/' ||
        backendUrl.search ||
        backendUrl.hash
    ) {
        throw new Error(
            'BACKEND_ORIGIN must be an HTTP(S) loopback origin without credentials, path, query or fragment',
        );
    }

    return {
        plugins: [react()],
        define: { 'import.meta.env.VITE_API_MODE': JSON.stringify(apiMode) },
        server: {
            host: 'localhost',
            port: 3002,
            strictPort: true,
            headers,
            ...(apiMode === 'real' && command === 'serve' && !isPreview
                ? { proxy: { '/api': { target: backendUrl.origin, changeOrigin: false } } }
                : {}),
        },
        preview: { host: 'localhost', port: 3002, strictPort: true, headers },
        build: { outDir: 'build' },
    };
});
