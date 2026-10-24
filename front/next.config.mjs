import { fileURLToPath } from 'node:url';

const mode = process.env.NEXT_PUBLIC_API_MODE ?? (process.env.NODE_ENV === 'development' ? 'mock' : 'real');
const singleSessionE2E = process.env.FRONT_E2E_SINGLE_SESSION === '1';
const e2eProductionMocks = process.env.FRONT_E2E_PRODUCTION_MOCKS === '1';
const singleSessionDevelopment = singleSessionE2E && process.env.NODE_ENV === 'development';
if (!['mock', 'real'].includes(mode)) throw new Error('NEXT_PUBLIC_API_MODE must be mock or real');
if (e2eProductionMocks && (process.env.NODE_ENV !== 'production' || mode !== 'mock' || !singleSessionE2E))
    throw new Error(
        'FRONT_E2E_PRODUCTION_MOCKS requires NODE_ENV=production, NEXT_PUBLIC_API_MODE=mock and FRONT_E2E_SINGLE_SESSION=1',
    );
if (mode === 'mock' && process.env.NODE_ENV === 'production' && !e2eProductionMocks)
    throw new Error('Production builds cannot enable browser mocks');
const backend = new URL(process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:3001');
if (
    !['http:', 'https:'].includes(backend.protocol) ||
    backend.username ||
    backend.password ||
    backend.pathname !== '/' ||
    backend.search ||
    backend.hash
)
    throw new Error('BACKEND_ORIGIN must be a clean HTTP origin');

/** @type {import('next').NextConfig} */
const config = {
    poweredByHeader: false,
    outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)),
    transpilePackages: ['@meal-planner/design-system'],
    env: {
        NEXT_PUBLIC_API_MODE: mode,
        NEXT_PUBLIC_E2E_PRODUCTION_MOCKS: e2eProductionMocks ? '1' : '0',
    },
    ...(e2eProductionMocks ? { distDir: '.next-e2e' } : {}),
    ...(singleSessionDevelopment
        ? {
              // A complete cross-browser iteration intentionally keeps one dev server alive.
              // Dispose inactive route entries quickly instead of retaining every visited page.
              onDemandEntries: { maxInactiveAge: 1_000, pagesBufferLength: 1 },
              experimental: { webpackMemoryOptimizations: true },
          }
        : {}),
    webpack(config) {
        config.resolve.extensionAlias = { ...config.resolve.extensionAlias, '.js': ['.ts', '.tsx', '.js'] };
        if (singleSessionDevelopment) config.cache = false;
        return config;
    },
    async headers() {
        return [
            {
                source: '/offline-worker.js',
                headers: [
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                    { key: 'Service-Worker-Allowed', value: '/' },
                ],
            },
        ];
    },
    async rewrites() {
        return mode === 'real'
            ? [
                  { source: '/api/:path*', destination: `${backend.origin}/api/:path*` },
                  { source: '/health/live', destination: `${backend.origin}/health/live` },
                  { source: '/health/ready', destination: `${backend.origin}/health/ready` },
              ]
            : [];
    },
};
export default config;
