import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';

const output = process.env.QA_OUTPUT_DIR;
if (!output) throw new Error('Set QA_OUTPUT_DIR to a dedicated temporary directory');
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run E2E through npm run test:e2e:front');
export default defineConfig({
    fullyParallel: false,
    workers: 1,
    retries: 0,
    testDir: './e2e-front',
    timeout: 600_000,
    outputDir: join(output, 'front-results'),
    reporter: 'list',
    projects: [
        { name: 'front-desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'front-mobile', use: { ...devices['Pixel 7'] } },
    ],
    use: { baseURL: 'http://localhost:3000', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    webServer: {
        command: `"${process.execPath}" "${npm}" --prefix front run dev`,
        env: { NEXT_PUBLIC_API_MODE: 'mock' },
        reuseExistingServer: false,
        timeout: 120_000,
        url: 'http://localhost:3000/auth',
    },
});
