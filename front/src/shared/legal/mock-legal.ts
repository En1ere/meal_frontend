import type { ApiClient } from '../api/client.js';
import type { Success } from '../api/contracts.generated.js';

export type ConsentKind = 'ai_data_access' | 'special_category' | 'dissemination' | 'marketing';
export type LegalDocumentKind = 'offer' | 'privacy_notice' | ConsentKind;
export type ImmutableLegalDocumentRef = Success<'GET /api/v1/legal/manifest'>['data']['documents'][number]['document'];
type Manifest = Success<'GET /api/v1/legal/manifest'>['data'];
type ConsentState = Success<'GET /api/v1/settings/legal-consents'>['data'];
type ConsentHistory = Success<'GET /api/v1/settings/legal-consents/history'>['data'];

const titles: Record<LegalDocumentKind, string> = {
    offer: 'Условия использования',
    privacy_notice: 'Политика конфиденциальности',
    ai_data_access: 'Использование личных данных в AI',
    special_category: 'Данные о здоровье и питании',
    dissemination: 'Публикация материалов',
    marketing: 'Маркетинговые сообщения',
};
const draftHrefs: Record<LegalDocumentKind, string> = {
    offer: '/legal/terms',
    privacy_notice: '/legal/privacy',
    ai_data_access: '/legal/ai-consent',
    special_category: '/legal/special-category-consent',
    dissemination: '/legal/dissemination-consent',
    marketing: '/legal/marketing-consent',
};

export interface LegalDocument {
    id: LegalDocumentKind;
    title: string;
    version: string;
    status: 'published' | 'draft';
    href: string | null;
    requiredAtRegistration: boolean;
    acknowledgementOnly: boolean;
    demonstration: boolean;
    document: ImmutableLegalDocumentRef;
}

export interface PublicLegalManifest {
    status: Manifest['status'];
    documents: LegalDocument[];
}

export interface LegalSettings {
    manifestStatus: Manifest['status'];
    documents: LegalDocument[];
    consents: Record<ConsentKind, ConsentState['consents'][number]>;
    history: ConsentHistory['events'];
}

const toDocuments = (manifest: Manifest): LegalDocument[] =>
    manifest.documents.map((item) => ({
        id: item.kind,
        title: `${titles[item.kind]}${item.status === 'demonstration' ? ' (демо)' : ''}`,
        version: String(item.document.documentVersion),
        status: manifest.status === 'approved' && item.status === 'approved' ? 'published' : 'draft',
        href: item.publicUrl ?? draftHrefs[item.kind],
        requiredAtRegistration: item.required,
        acknowledgementOnly: item.kind === 'privacy_notice',
        demonstration: item.status === 'demonstration',
        document: item.document,
    }));

const combine = (manifest: Manifest, state: ConsentState, history: ConsentHistory): LegalSettings => ({
    manifestStatus: state.manifestStatus,
    documents: toDocuments(manifest),
    consents: Object.fromEntries(state.consents.map((item) => [item.kind, item])) as LegalSettings['consents'],
    history: history.events,
});

export async function getPublicLegalManifest(api: ApiClient, signal?: AbortSignal): Promise<PublicLegalManifest> {
    const response = await api.request('GET /api/v1/legal/manifest', undefined, signal);
    return { status: response.data.status, documents: toDocuments(response.data) };
}

export async function getLegalSettings(api: ApiClient, signal?: AbortSignal): Promise<LegalSettings> {
    const [manifest, state, history] = await Promise.all([
        api.request('GET /api/v1/legal/manifest', undefined, signal),
        api.request('GET /api/v1/settings/legal-consents', undefined, signal),
        api.request('GET /api/v1/settings/legal-consents/history', undefined, signal),
    ]);
    return combine(manifest.data, state.data, history.data);
}

export async function setConsent(
    api: ApiClient,
    input: { kind: ConsentKind; enabled: boolean; revision: number; document: ImmutableLegalDocumentRef },
    signal?: AbortSignal,
): Promise<LegalSettings> {
    const idempotencyKey = crypto.randomUUID();
    if (input.enabled) {
        await api.request(
            'POST /api/v1/settings/legal-consents/{kind}/accept',
            { accepted: true, document: input.document, expectedRevision: input.revision, idempotencyKey },
            signal,
            { kind: input.kind },
        );
    } else {
        await api.request(
            'POST /api/v1/settings/legal-consents/{kind}/revoke',
            { expectedRevision: input.revision, idempotencyKey },
            signal,
            { kind: input.kind },
        );
    }
    return getLegalSettings(api, signal);
}

export function hasPublishedRegistrationDocuments(
    manifest: PublicLegalManifest | undefined,
    options: { allowDemonstration?: boolean } = {},
) {
    if (!manifest) return false;
    const acceptsApproved = manifest.status === 'approved';
    const acceptsDemonstration = manifest.status === 'demonstration' && options.allowDemonstration === true;
    if (!acceptsApproved && !acceptsDemonstration) return false;
    return ['offer', 'privacy_notice'].every((id) =>
        manifest.documents.some(
            (item) =>
                item.id === id &&
                ((acceptsApproved && item.status === 'published' && !item.demonstration) ||
                    (acceptsDemonstration && item.demonstration)),
        ),
    );
}

export function hasReviewableRegistrationDocuments(manifest: PublicLegalManifest | undefined) {
    if (!manifest || !['approved', 'demonstration'].includes(manifest.status)) return false;
    return ['offer', 'privacy_notice'].every((id) => manifest.documents.some((item) => item.id === id && item.href));
}
