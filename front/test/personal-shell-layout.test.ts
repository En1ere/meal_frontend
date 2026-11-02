import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async (path: string) => readFile(path, 'utf8');

await test('account and offline settings retain the shared personal application shell', async () => {
    const [personalShell, accountRoute, offlineRoute, accountPage, offlinePage] = await Promise.all([
        source('src/widgets/personal-shell/PersonalShell.tsx'),
        source('src/app/settings/account/page.tsx'),
        source('src/app/settings/offline/page.tsx'),
        source('src/widgets/account-security/client.tsx'),
        source('src/features/offline/page.tsx'),
    ]);

    assert.match(personalShell, /allowOffline\s*=\s*false/);
    assert.match(personalShell, /<SessionGuard context="user" allowOffline=\{allowOffline\}>/);
    assert.match(accountRoute, /<PersonalShell>/);
    assert.match(offlineRoute, /<PersonalShell allowOffline>/);
    for (const content of [accountPage, offlinePage]) {
        assert.doesNotMatch(content, /<Brand\b|<ThemeControl\b/);
        assert.doesNotMatch(content, /<main\b[^>]*id="main"/);
    }
});
