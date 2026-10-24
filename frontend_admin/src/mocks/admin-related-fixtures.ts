import type { AdminRow } from './admin-model.js';
import fixture from '../../contracts/dev-users.json' with { type: 'json' };

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const date = '2026-09-28T08:00:00.000Z';
const end = '2026-10-28T08:00:00.000Z';
const admin = fixture.users[0]!.id;
const user = fixture.users[2]!.id;
const row = (n: number, data: AdminRow): AdminRow => ({ id: id(n), created_at: date, version: '1', ...data });
// Scalar columns of the prepared schema. These are synthetic read fixtures, never a SQL seed.
export function relatedFixtures(): Record<string, AdminRow[]> {
    return {
        units: [row(23, { code: 'ml', dimension: 'volume', factor: '1', approximate: false })],
        categories: [row(51, { code: 'dairy', name: 'Молочные продукты', parent_id: null })],
        data_scopes: [row(47, { kind: 'private', user_id: user, family_id: null })],
        subscription_periods: [
            row(30, {
                subscription_id: id(3),
                starts_at: date,
                ends_at: end,
                grant_kind: 'development',
                order_id: null,
            }),
        ],
        subscription_changes: [],
        grace_incidents: [],
        ai_quota_periods: [
            row(31, {
                subscription_id: id(3),
                family_coverage_id: null,
                trial_claim_id: null,
                starts_at: date,
                ends_at: end,
                granted_actions: '120',
            }),
        ],
        ai_buckets: [
            row(32, {
                kind: 'subscription',
                granted: '120',
                expires_at: end,
                balance_projection: '120',
                reserved_projection: '0',
                user_id: user,
                family_id: null,
                quota_period_id: id(31),
                order_id: null,
            }),
        ],
        payment_events: [
            row(33, {
                provider: 'development',
                external_event_id: 'development-pending',
                occurred_at: date,
                received_at: date,
                processed_at: null,
                attempt_id: id(22),
            }),
        ],
        payment_reconciliations: [
            row(34, {
                status: 'pending',
                requested_at: date,
                reason: 'Проверка тестового неизвестного результата',
                attempt_id: id(22),
                requested_by: admin,
            }),
        ],
        payment_refunds: [],
        support_events: [
            row(35, {
                kind: 'created',
                reason: null,
                recorded_at: date,
                ticket_id: id(5),
                actor_id: fixture.users[6]!.id,
            }),
        ],
        staff_grants: [
            row(36, {
                permission: 'catalog.review',
                scope: 'global',
                valid_until: null,
                revoked_at: null,
                user_id: fixture.users[1]!.id,
                granted_by: admin,
            }),
        ],
        job_attempts: [
            row(37, { attempt_no: 1, started_at: date, finished_at: '2026-09-28T08:00:30.000Z', job_id: id(13) }),
        ],
        legal_request_steps: [
            row(38, { kind: 'identity', status: 'pending', completed_at: null, request_id: id(12), approved_by: null }),
        ],
        compensation_items: [
            row(39, { status: 'pending', request_id: id(11), source_event_id: id(9), result_event_id: null }),
        ],
        mail_campaigns: [
            row(40, {
                kind: 'service',
                status: 'draft',
                scheduled_at: null,
                announcement_id: id(8),
                created_by: admin,
            }),
        ],
        notification_deliveries: [],
        moderation_decisions: [],
        moderation_claims: [],
        moderation_correspondence: [],
        appeals: [],
        product_barcodes: [row(41, { code: '4600000000012', format: 'ean13', verified_at: null, product_id: id(7) })],
        composition_versions: [
            row(42, {
                revision: 1,
                composition_text: 'Молоко',
                kcal: '52',
                protein: '3',
                fat: '2.5',
                carbs: '4.7',
                basis_quantity: '100',
                source: 'development_fixture',
                confidence: null,
                ingredient_id: null,
                variant_id: null,
                product_id: id(7),
                basis_unit_id: id(23),
            }),
        ],
        catalog_merges: [],
        ingredient_variants: [row(43, { name: 'Молоко 2,5%', status: 'active', ingredient_id: id(44) })],
        ingredients: [
            row(44, {
                name: 'Молоко',
                status: 'active',
                default_unit_id: id(23),
                primary_category_id: id(51),
                default_storage_type: null,
            }),
        ],
        recipe_revisions: [
            row(45, {
                revision: 1,
                title: 'Тестовая молочная каша',
                portions: 2,
                method: 'boil',
                change_kind: 'created',
                recipe_id: id(46),
                created_by: user,
            }),
        ],
        recipes: [
            row(46, {
                title: 'Тестовая молочная каша',
                status: 'draft',
                archived_at: null,
                author_id: user,
                scope_id: id(47),
                base_recipe_id: null,
            }),
        ],
        recipe_steps: [
            row(48, {
                position: 1,
                text: 'Смешать ингредиенты и варить до готовности.',
                duration_seconds: 600,
                temperature: null,
                revision_id: id(45),
            }),
        ],
        recipe_ingredients: [
            row(49, {
                position: 1,
                quantity: '300',
                optional: false,
                revision_id: id(45),
                ingredient_id: null,
                variant_id: null,
                product_id: id(7),
                source_recipe_id: null,
                unit_id: id(23),
            }),
        ],
        family_coverages: [],
        ai_ledger: [
            row(50, { kind: 'grant', delta: '120', reserved_delta: '0', recorded_at: date, bucket_id: id(32) }),
        ],
        billing_documents: [],
        catalog_proposal_revisions: [],
        notifications: [],
    };
}
