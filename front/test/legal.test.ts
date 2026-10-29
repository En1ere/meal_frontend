import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { ApiClient } from '../src/shared/api/client.js';
import { draftLegalDocuments } from '../src/shared/legal/draft-documents.js';
import { getPublicLegalManifest, hasPublishedRegistrationDocuments } from '../src/shared/legal/mock-legal.js';
import { legalHandle, legalSettings, mockLegalManifest, type LegalMockState } from '../src/mocks/legal.js';

const userId = 'user-demo';
const success = (data: unknown) => Response.json(data);
const fail = (status: number, code = 'ERROR') => Response.json({ error: { code } }, { status });
const command = (state: LegalMockState, action: 'accept' | 'revoke', revision: number, key = crypto.randomUUID()) =>
    legalHandle({
        state,
        userId,
        path: `/api/v1/settings/legal-consents/ai_data_access/${action}`,
        method: 'POST',
        input:
            action === 'accept'
                ? {
                      accepted: true,
                      expectedRevision: revision,
                      document: mockLegalManifest.documents.find((item) => item.kind === 'ai_data_access')!.document,
                      idempotencyKey: key,
                  }
                : { expectedRevision: revision, idempotencyKey: key },
        now: Date.parse('2026-10-13T08:00:00.000Z') + revision * 60_000,
        success,
        fail,
    });

void test('legal mock supports accept, revoke and re-accept with independent state', () => {
    const state: LegalMockState = {};
    assert.equal(command(state, 'accept', 0)?.status, 200);
    assert.equal(legalSettings(state, userId).consents.find((item) => item.kind === 'ai_data_access')?.enabled, true);
    assert.equal(legalSettings(state, userId).consents.find((item) => item.kind === 'marketing')?.enabled, false);
    assert.equal(command(state, 'revoke', 1)?.status, 200);
    assert.equal(legalSettings(state, userId).consents.find((item) => item.kind === 'ai_data_access')?.enabled, false);
    assert.equal(command(state, 'accept', 2)?.status, 200);
    assert.deepEqual(
        state[userId]!.history.map((item) => item.action),
        ['accepted', 'revoked', 'accepted'],
    );
});

void test('legal mock replays an idempotent command and rejects stale evidence', async () => {
    const state: LegalMockState = {};
    const key = crypto.randomUUID();
    assert.equal(command(state, 'accept', 0, key)?.status, 200);
    assert.equal(command(state, 'accept', 0, key)?.status, 200);
    assert.equal(state[userId]!.history.length, 1);
    assert.equal(command(state, 'accept', 1, key)?.status, 409);
    const stale = legalHandle({
        state: {},
        userId,
        path: '/api/v1/settings/legal-consents/ai_data_access/accept',
        method: 'POST',
        input: {
            accepted: true,
            expectedRevision: 0,
            document: { ...mockLegalManifest.documents[2]!.document, documentVersion: 99 },
            idempotencyKey: crypto.randomUUID(),
        },
        now: Date.now(),
        success,
        fail,
    });
    assert.equal(stale?.status, 409);
    assert.equal(((await stale.json()) as { error: { code: string } }).error.code, 'LEGAL_DOCUMENT_STALE');
});

void test('public draft catalog is allowlisted, complete and keeps release flags blocked', () => {
    const root = path.resolve(process.cwd(), '..', 'docs', 'legal');
    const manifest = JSON.parse(readFileSync(path.join(root, 'package-manifest.json'), 'utf8')) as {
        packageStatus: string;
        publicationEligible: boolean;
        documents: Array<{ file: string; status: string; publicationEligible: boolean }>;
    };
    assert.equal(draftLegalDocuments.length, 11);
    assert.equal(new Set(draftLegalDocuments.map((document) => document.slug)).size, 11);
    assert.deepEqual(
        draftLegalDocuments.map((document) => document.filename).sort(),
        manifest.documents.map((document) => document.file).sort(),
    );
    assert.equal(manifest.packageStatus, 'draft_blocked');
    assert.equal(manifest.publicationEligible, false);
    assert.ok(manifest.documents.every((document) => document.status === 'draft_blocked'));
    assert.ok(manifest.documents.every((document) => document.publicationEligible === false));

    for (const document of draftLegalDocuments) {
        const source = readFileSync(path.join(root, document.filename), 'utf8');
        const markers = source.match(/\[[^\]]+\]/g) ?? [];
        assert.ok(source.includes('[Тут будут данные]'), `${document.filename} must expose the agreed placeholder`);
        assert.ok(
            markers.every((marker) => marker === '[Тут будут данные]' || marker === '[ ]'),
            `${document.filename} contains an unexpected placeholder`,
        );
    }
});

void test('demonstration documents stay readable drafts and cannot unlock real registration', async () => {
    const api = {
        request: () => Promise.resolve({ data: mockLegalManifest }),
    } as unknown as ApiClient;
    const documents = await getPublicLegalManifest(api);
    assert.ok(documents.every((document) => document.status === 'draft'));
    assert.ok(documents.every((document) => document.href?.startsWith('/legal/')));
    assert.equal(hasPublishedRegistrationDocuments(documents), false);
    assert.equal(hasPublishedRegistrationDocuments(documents, { allowDemonstration: true }), true);
});
