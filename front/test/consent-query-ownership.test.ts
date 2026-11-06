import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { consentKeys } from '../src/entities/consent/model.js';

const source = (relative: string) => readFileSync(path.resolve(process.cwd(), relative), 'utf8');

void test('consent settings key preserves exact anonymous and account-scoped tuples', () => {
    assert.deepEqual(consentKeys.settings(undefined), ['legal-settings', undefined]);
    assert.deepEqual(consentKeys.settings('user-1'), ['legal-settings', 'user-1']);
});

void test('consent entity and privacy share the canonical settings owner without changing cache recovery', () => {
    const client = source('src/entities/consent/client.ts');
    const privacy = source('src/features/privacy/privacy-page.tsx');
    const legal = source('src/shared/legal/mock-legal.ts');

    assert.match(client, /queryKey: consentKeys\.settings\(session\.data\?\.id\)/u);
    assert.match(client, /queryFn: \(\{ signal \}\) => getLegalSettings\(api!, signal\)/u);
    assert.match(privacy, /const key = consentKeys\.settings\(session\.data\?\.id\)/u);
    assert.match(privacy, /queryClient\.setQueryData\(key, value\)/u);
    assert.match(privacy, /const refreshed = await query\.refetch\(\)/u);
    assert.doesNotMatch(client, /legalSettingsKey/u);
    assert.doesNotMatch(privacy, /legalSettingsKey/u);
    assert.doesNotMatch(legal, /legalSettingsKey/u);
});

void test('legal aggregate transport and consent command behavior remain in the shared adapter', () => {
    const legal = source('src/shared/legal/mock-legal.ts');

    assert.match(legal, /GET \/api\/v1\/legal\/manifest/u);
    assert.match(legal, /GET \/api\/v1\/settings\/legal-consents/u);
    assert.match(legal, /GET \/api\/v1\/settings\/legal-consents\/history/u);
    assert.match(legal, /const idempotencyKey = crypto\.randomUUID\(\)/u);
    assert.match(legal, /POST \/api\/v1\/settings\/legal-consents\/\{kind\}\/accept/u);
    assert.match(legal, /POST \/api\/v1\/settings\/legal-consents\/\{kind\}\/revoke/u);
    assert.match(legal, /return getLegalSettings\(api, signal\)/u);
});
