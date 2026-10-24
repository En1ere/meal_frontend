import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { ConsentKind, ImmutableLegalDocumentRef } from '../shared/legal/mock-legal.js';

export const consentKinds = ['ai_data_access', 'special_category', 'dissemination', 'marketing'] as const;
const allKinds = ['offer', 'privacy_notice', ...consentKinds] as const;
const refSchema = contracts['GET /api/v1/legal/manifest'].success.shape.data.shape.documents.element.shape.document;
const consentRowSchema = z.object({
    enabled: z.boolean(),
    changedAt: z.string().nullable(),
    revision: z.number().int().nonnegative(),
    document: refSchema.nullable(),
});
const historySchema = contracts['GET /api/v1/settings/legal-consents/history'].success.shape.data.shape.events.element;
const userLegalSchema = z.object({
    consents: z.record(z.enum(consentKinds), consentRowSchema),
    history: z.array(historySchema),
    replay: z.record(
        z.string(),
        z.object({ kind: z.enum(consentKinds), action: z.enum(['accepted', 'revoked']), input: z.string() }),
    ),
});
export const legalMockStateSchema = z.record(z.string(), userLegalSchema);
export type LegalMockState = z.infer<typeof legalMockStateSchema>;

const documentRef = (index: number): ImmutableLegalDocumentRef => ({
    documentId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
    documentVersion: 1,
    bodyHash: `sha256:${String(index + 1).repeat(64)}`,
    contentReleaseId: '00000000-0000-4000-8000-000000000001',
    publishEventId: '00000000-0000-4000-8000-000000000002',
});

export const mockLegalManifest = {
    contractVersion: 1 as const,
    status: 'demonstration' as const,
    documents: allKinds.map((kind, index) => ({
        kind,
        required: kind === 'offer' || kind === 'privacy_notice',
        withdrawalSupported: kind !== 'offer' && kind !== 'privacy_notice',
        document: documentRef(index),
        effectiveAt: '2026-01-01T00:00:00.000Z',
        publicUrl: null,
        locale: 'ru-RU',
        jurisdiction: 'demonstration',
        status: 'demonstration' as const,
    })),
};

function emptyUser() {
    return {
        consents: Object.fromEntries(
            consentKinds.map((kind) => [kind, { enabled: false, changedAt: null, revision: 0, document: null }]),
        ) as Record<ConsentKind, z.infer<typeof consentRowSchema>>,
        history: [] as z.infer<typeof historySchema>[],
        replay: {},
    };
}

export function createLegalFixtureState(userIds: string[]): LegalMockState {
    return Object.fromEntries(
        userIds.map((userId) => {
            const row = emptyUser();
            const dissemination = row.consents.dissemination;
            dissemination.enabled = true;
            dissemination.changedAt = '2026-01-01T00:00:00.000Z';
            dissemination.revision = 1;
            dissemination.document = mockLegalManifest.documents.find(
                (item) => item.kind === 'dissemination',
            )!.document;
            return [userId, row];
        }),
    );
}

export function legalSettings(state: LegalMockState, userId: string) {
    const row = (state[userId] ??= emptyUser());
    return {
        contractVersion: 1 as const,
        manifestStatus: 'demonstration' as const,
        consents: consentKinds.map((kind) => {
            const item = row.consents[kind];
            return {
                kind,
                enabled: item.enabled,
                revision: item.revision,
                changedAt: item.changedAt,
                document: item.enabled ? item.document : null,
                blockedFeatures: item.enabled
                    ? []
                    : [
                          kind === 'ai_data_access'
                              ? 'ai.personal_data'
                              : kind === 'special_category'
                                ? 'health.personalization'
                                : kind === 'dissemination'
                                  ? 'profile.publication'
                                  : 'marketing.delivery',
                      ],
                action: item.enabled ? null : { href: '/settings/privacy', label: 'Ознакомиться и согласиться' },
            };
        }),
    };
}

export function hasConsent(state: LegalMockState, userId: string | null, kind: ConsentKind) {
    return !!userId && !!state[userId]?.consents[kind]?.enabled;
}

const requiredCode: Record<ConsentKind, string> = {
    ai_data_access: 'AI_PROCESSING_CONSENT_REQUIRED',
    special_category: 'SPECIAL_CATEGORY_CONSENT_REQUIRED',
    dissemination: 'DISSEMINATION_CONSENT_REQUIRED',
    marketing: 'MARKETING_CONSENT_REQUIRED',
};
export const consentRequiredCode = (kind: ConsentKind) => requiredCode[kind];

export function legalHandle(c: {
    state: LegalMockState;
    userId: string | null;
    path: string;
    method: string;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}): Response | null {
    if (c.path === '/api/v1/legal/manifest' && c.method === 'GET') return c.success(mockLegalManifest);
    if (!c.path.startsWith('/api/v1/settings/legal-consents')) return null;
    if (!c.userId) return c.fail(401);
    const row = (c.state[c.userId] ??= emptyUser());
    if (c.path === '/api/v1/settings/legal-consents' && c.method === 'GET')
        return c.success(legalSettings(c.state, c.userId));
    if (c.path === '/api/v1/settings/legal-consents/history' && c.method === 'GET')
        return c.success({ events: row.history });
    const match = /^\/api\/v1\/settings\/legal-consents\/([^/]+)\/(accept|revoke)$/.exec(c.path);
    if (!match || c.method !== 'POST' || !consentKinds.includes(match[1] as ConsentKind)) return c.fail(404);
    const kind = match[1] as ConsentKind;
    const action = match[2] === 'accept' ? 'accepted' : 'revoked';
    const route =
        action === 'accepted'
            ? contracts['POST /api/v1/settings/legal-consents/{kind}/accept']
            : contracts['POST /api/v1/settings/legal-consents/{kind}/revoke'];
    const parsed = route.request.safeParse(c.input);
    if (!parsed.success) return c.fail(400);
    const input = parsed.data;
    const serializedInput = JSON.stringify(input);
    const replay = row.replay[input.idempotencyKey];
    if (replay)
        return replay.kind === kind && replay.action === action && replay.input === serializedInput
            ? c.success(legalSettings(c.state, c.userId))
            : c.fail(409);
    const current = row.consents[kind];
    if (current.revision !== input.expectedRevision) return c.fail(412);
    const manifestDocument = mockLegalManifest.documents.find((item) => item.kind === kind)!;
    if (action === 'accepted') {
        if (!('document' in input)) return c.fail(400);
        const supplied: ImmutableLegalDocumentRef = refSchema.parse(input.document);
        if (JSON.stringify(supplied) !== JSON.stringify(manifestDocument.document))
            return c.fail(409, 'LEGAL_DOCUMENT_STALE');
        current.enabled = true;
        current.document = supplied;
    } else {
        current.enabled = false;
        current.document = null;
    }
    current.changedAt = new Date(c.now).toISOString();
    current.revision++;
    row.replay[input.idempotencyKey] = { kind, action, input: serializedInput };
    row.history.unshift({
        id: crypto.randomUUID(),
        kind,
        action,
        occurredAt: current.changedAt,
        document: current.document,
        evidenceMode: 'demonstration',
    });
    return c.success(legalSettings(c.state, c.userId));
}
