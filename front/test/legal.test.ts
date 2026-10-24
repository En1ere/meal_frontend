import assert from 'node:assert/strict';
import { test } from 'node:test';
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
