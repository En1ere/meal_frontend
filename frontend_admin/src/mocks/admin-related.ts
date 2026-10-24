import { z } from 'zod';
import type { Principal } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import type { AdminRecord, AdminRow, AdminSection } from './admin-model.js';
import { adminSources } from './admin-sources.js';
import { relatedSources } from './admin-related-sources.js';

export function relatedCollections(section: AdminSection) {
    return Object.entries(relatedSources[section] ?? {}).map(([key, source]) => ({ key, label: source.label }));
}
export function relatedRows(state: MockState, section: AdminSection, id: string, collection: string): AdminRow[] {
    const source = Object.hasOwn(relatedSources[section] ?? {}, collection)
        ? relatedSources[section]?.[collection]
        : undefined;
    if (!source) return [];
    const rows = (table: string) => state.admin.tables[table] ?? [];
    const ids = (table: string, key: string, value: string) =>
        new Set(
            rows(table)
                .filter((row) => row[key] === value)
                .map((row) => row.id),
        );
    const orderAttempts = ids('payment_attempts', 'order_id', id);
    const coverages = ids('family_coverages', 'subscription_id', id);
    const periods = new Set(
        rows('ai_quota_periods')
            .filter((row) => row.subscription_id === id || coverages.has(row.family_coverage_id))
            .map((row) => row.id),
    );
    const buckets = new Set(
        rows('ai_buckets')
            .filter((row) => periods.has(row.quota_period_id))
            .map((row) => row.id),
    );
    const parent = rows('moderation_cases').find((row) => row.id === id);
    const recipe = rows('recipe_revisions').find((row) => row.id === parent?.recipe_revision_id)?.recipe_id;
    const proposal = rows('catalog_proposal_revisions').find(
        (row) => row.id === parent?.catalog_proposal_revision_id,
    )?.proposal_id;
    if (section === 'access' && collection === 'sessions')
        return state.sessions
            .filter((session) => session.principal.id === id && session.principal.context !== 'user')
            .map((session) => ({
                id: session.principal.sessionId,
                version: '1',
                created_at: session.authenticatedAt,
                user_id: id,
                kind: 'staff',
                auth_context: session.principal.context,
                authenticated_at: session.authenticatedAt,
                mfa_verified_at: session.authenticatedAt,
                expires_at: session.principal.expiresAt,
                revoked_at: session.revoked ? 'Время отзыва не сохранено в mock' : null,
            }));
    return rows(source.table).filter((row) => {
        switch (section) {
            case 'users':
                return collection === 'support'
                    ? row.requester_id === id
                    : collection === 'audit'
                      ? row.actor_id === id
                      : row.user_id === id;
            case 'sanctions':
                return row.sanction_id === id;
            case 'subscriptions':
                return collection === 'ai-buckets'
                    ? periods.has(row.quota_period_id)
                    : collection === 'ai-ledger'
                      ? buckets.has(row.bucket_id)
                      : row.subscription_id === id;
            case 'families':
                return row.family_id === id;
            case 'payments':
                return collection === 'attempts' || collection === 'documents'
                    ? row.order_id === id
                    : orderAttempts.has(row.attempt_id);
            case 'queues':
                return collection === 'recipe-revisions'
                    ? recipe !== undefined && row.recipe_id === recipe
                    : collection === 'catalog-revisions'
                      ? proposal !== undefined && row.proposal_id === proposal
                      : row.case_id === id;
            case 'catalog':
                return collection === 'variants'
                    ? row.id === rows('brand_products').find((parent) => parent.id === id)?.variant_id
                    : collection === 'merges'
                      ? row.source_product_id === id || row.target_product_id === id
                      : row.product_id === id;
            case 'news':
                return collection === 'campaigns'
                    ? row.announcement_id === id
                    : ids('mail_campaigns', 'announcement_id', id).has(row.campaign_id) ||
                          ids('notifications', 'announcement_id', id).has(row.notification_id);
            case 'access':
                return row.user_id === id;
            case 'legal-requests':
            case 'rollback':
                return row.request_id === id;
            case 'operations':
                return row.job_id === id;
            case 'support':
                return row.ticket_id === id;
            default:
                return false;
        }
    });
}
export function relatedPage(
    state: MockState,
    section: AdminSection,
    id: string,
    collection: string,
    input: { cursor?: string | undefined; limit?: number | undefined },
    actor: Principal,
): { status: number; data?: { items: AdminRecord[]; nextCursor: string | null } } {
    const source = Object.hasOwn(relatedSources[section] ?? {}, collection)
        ? relatedSources[section]?.[collection]
        : undefined;
    if (!source || section === 'overview') return { status: 404 };
    const parentExists =
        section === 'access' || section === 'users'
            ? state.users.some((user) => user.id === id)
            : (state.admin.tables[adminSources[section].table] ?? []).some((row) => row.id === id);
    if (!parentExists) return { status: 404 };
    const binding = JSON.stringify([section, id, collection, input.limit ?? 25, actor.id, actor.sessionId]);
    let after = '';
    if (input.cursor) {
        try {
            after = z
                .strictObject({ id: z.uuid(), binding: z.literal(binding) })
                .parse(JSON.parse(atob(input.cursor.replaceAll('-', '+').replaceAll('_', '/')))).id;
        } catch {
            return { status: 400 };
        }
    }
    const found = relatedRows(state, section, id, collection)
        .filter((row) => String(row.id) > after)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const page = found.slice(0, input.limit ?? 25);
    const value = (row: AdminRow, key: string) =>
        row[key] === null || row[key] === undefined ? null : String(row[key]);
    return {
        status: 200,
        data: {
            items: page.map((row) => ({
                id: String(row.id),
                title: value(row, source.title) ?? String(row.id),
                status: source.status ? value(row, source.status) : null,
                version: String(row.version ?? '1'),
                updatedAt: null,
                fields: [
                    { key: 'createdAt', label: 'Создано', value: value(row, 'created_at') },
                    ...source.fields.map(([key, label]) => ({ key, label, value: value(row, key) })),
                ],
                related: [],
                actions: [],
            })),
            nextCursor:
                found.length > page.length
                    ? btoa(JSON.stringify({ id: page.at(-1)!.id, binding }))
                          .replaceAll('+', '-')
                          .replaceAll('/', '_')
                          .replaceAll('=', '')
                    : null,
        },
    };
}
