import {
    contentCompareSchema,
    contentMergeSchema,
    contentModerateSchema,
    contentNotDuplicateSchema,
    contentResultSchema,
    type ContentCard,
    type ContentCommand,
    type ContentResult,
} from '../features/content/contracts.js';
import type { AdminState } from './admin-model.js';

export class ContentMockError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
function cards(state: AdminState): ContentCard[] {
    return (state.tables.brand_products ?? []).map((row) => {
        const composition = state.tables.composition_versions?.find((value) => value.product_id === row.id);
        return {
            id: String(row.id),
            version: Number(row.version ?? 1),
            name: String(row.name),
            fields: {
                name: String(row.name),
                brand: row.brand_id ? String(row.brand_id) : null,
                composition: composition?.composition_text ? String(composition.composition_text) : null,
                kcal: composition?.kcal ? String(composition.kcal) : null,
                protein: composition?.protein ? String(composition.protein) : null,
                fat: composition?.fat ? String(composition.fat) : null,
                carbs: composition?.carbs ? String(composition.carbs) : null,
            },
            variants: [
                JSON.stringify({ quantity: row.package_quantity, unit: row.package_unit_id, variant: row.variant_id }),
            ],
            authors: row.created_by ? [String(row.created_by)] : [],
            sources: composition?.source ? [String(composition.source)] : [],
            aliasOf: null,
        };
    });
}
export function ensureContentFixtures(state: AdminState) {
    if (state.tables.content_catalog_cards) return;
    const values = cards(state);
    const first = values[0];
    if (first)
        values.push({
            ...structuredClone(first),
            id: '10000000-0000-4000-8000-000000000107',
            name: 'Молоко 2,5% · кандидат',
            fields: { ...first.fields, name: 'Молоко 2,5% · кандидат' },
            variants: ['Тестовая фасовка 500 мл'],
        });
    state.tables.content_catalog_cards = values.map((value) => ({ id: value.id, payload: JSON.stringify(value) }));
}
function load(state: AdminState, section: 'queues' | 'catalog', id: string): ContentResult {
    ensureContentFixtures(state);
    const saved = state.tables.content_workspaces?.find((row) => row.id === id && row.section === section);
    const catalog = (state.tables.content_catalog_cards ?? []).map(
        (row) => JSON.parse(String(row.payload)) as ContentCard,
    );
    if (saved)
        return {
            ...contentResultSchema.parse(JSON.parse(String(saved.payload))),
            cards: catalog,
            comparison: null,
            message: '',
        };
    if (section === 'catalog') {
        const card = catalog.find((value) => value.id === id);
        if (!card) throw new ContentMockError(404, 'Карточка не найдена.');
        return {
            section,
            id,
            version: card.version,
            current: null,
            pending: null,
            status: card.aliasOf ? 'merged' : 'active',
            history: [],
            cards: catalog,
            comparison: null,
            message: '',
        };
    }
    const queue = state.tables.moderation_cases?.find((row) => row.id === id);
    if (!queue) throw new ContentMockError(404, 'Материал не найден.');
    const revision = state.tables.recipe_revisions?.find((row) => row.id === queue.recipe_revision_id);
    const recipe = state.tables.recipes?.find((row) => row.id === revision?.recipe_id);
    return {
        section,
        id,
        version: Number(queue.version ?? 1),
        status: String(queue.status),
        current: null,
        pending: revision
            ? {
                  id: String(revision.id),
                  version: Number(revision.revision ?? 1),
                  fields: {
                      title: String(revision.title),
                      portions: String(revision.portions),
                      method: String(revision.method),
                      steps: (state.tables.recipe_steps ?? [])
                          .filter((row) => row.revision_id === revision.id)
                          .map((row) => String(row.text))
                          .join('\n'),
                      author: recipe?.author_id ? String(recipe.author_id) : null,
                  },
              }
            : null,
        history: [],
        cards: catalog,
        comparison: null,
        message: '',
    };
}
export function contentWorkspaceCommand(
    state: AdminState,
    section: 'queues' | 'catalog',
    id: string,
    command: ContentCommand,
    context: { actorId: string; critical: boolean; now: number },
): ContentResult {
    const view = load(state, section, id);
    if (command.action === 'load') return view;
    const parsed =
        command.action === 'moderate'
            ? contentModerateSchema.safeParse(command.data)
            : command.action === 'compare'
              ? contentCompareSchema.safeParse(command.data)
              : command.action === 'merge'
                ? contentMergeSchema.safeParse(command.data)
                : contentNotDuplicateSchema.safeParse(command.data);
    if (!parsed.success) throw new ContentMockError(400, 'Проверьте поля команды.');
    const journal = (state.tables.content_commands ??= []);
    const digest = JSON.stringify({ section, id, command });
    if ('idempotencyKey' in command.data) {
        const idempotencyKey = command.data.idempotencyKey;
        const previous = journal.find((row) => row.id === idempotencyKey && row.actor_id === context.actorId);
        if (previous) {
            if (previous.digest !== digest) throw new ContentMockError(409, 'Ключ команды уже использован.');
            return contentResultSchema.parse(JSON.parse(String(previous.result)));
        }
    }
    if (command.action === 'moderate') {
        if (section !== 'queues') throw new ContentMockError(400, 'Неверный раздел.');
        const c = command.data;
        if (c.version !== view.version) throw new ContentMockError(409, 'Материал изменился. Обновите версию.');
        if ((c.action === 'approve' || c.action === 'reject') && !view.pending)
            throw new ContentMockError(409, 'Нет версии, ожидающей проверки.');
        const revisionSnapshot = JSON.stringify({ current: view.current, pending: view.pending });
        if (c.action === 'approve') {
            view.current = view.pending;
            view.pending = null;
            view.status = 'approved';
        }
        if (c.action === 'reject') {
            view.pending = null;
            view.status = 'rejected';
        }
        if (c.action === 'hide' || c.action === 'unpublish') {
            if (!view.current) throw new ContentMockError(409, 'Нет опубликованной версии.');
            view.pending = view.current;
            view.current = null;
            view.status = c.action === 'hide' ? 'hidden' : 'unpublished';
        }
        view.version++;
        (state.tables.content_revision_history ??= []).push({
            id: crypto.randomUUID(),
            case_id: id,
            before_snapshot: revisionSnapshot,
            action: c.action,
            reason: c.reason,
            actor_id: context.actorId,
        });
        const queue = state.tables.moderation_cases?.find((row) => row.id === id);
        if (queue) {
            queue.status = view.status;
            queue.version = String(view.version);
        }
    } else {
        if (section !== 'catalog') throw new ContentMockError(400, 'Неверный раздел.');
        const c = command.data;
        const left = view.cards.find((card) => card.id === c.leftId);
        const right = view.cards.find((card) => card.id === c.rightId);
        if (!left || !right || left.id === right.id || left.aliasOf || right.aliasOf)
            throw new ContentMockError(400, 'Выберите две разные активные карточки.');
        if (left.version !== c.leftVersion || right.version !== c.rightVersion)
            throw new ContentMockError(409, 'Карточки изменились. Повторите сравнение.');
        const pairKey = [left, right]
            .map((card) => `${card.id}:${card.version}`)
            .sort()
            .join('|');
        if (command.action === 'not-duplicate') {
            const ignored = (state.tables.content_not_duplicates ??= []);
            if (!ignored.some((row) => row.id === pairKey)) ignored.push({ id: pairKey, reason: command.data.reason });
            view.message = 'Пара закрыта до изменения данных сравнения.';
        } else {
            const c = command.data;
            if (state.tables.content_not_duplicates?.some((row) => row.id === pairKey))
                throw new ContentMockError(409, 'Эта пара уже отмечена как не дубли для текущих версий.');
            if (c.canonicalId !== left.id && c.canonicalId !== right.id)
                throw new ContentMockError(400, 'Выберите основную карточку из этой пары.');
            const conflicts = [...new Set([...Object.keys(left.fields), ...Object.keys(right.fields)])].filter(
                (field) => left.fields[field] !== right.fields[field],
            );
            const resolved: Record<string, string | null> = {};
            for (const field of Object.keys(left.fields)) {
                if (!conflicts.includes(field)) resolved[field] = left.fields[field] ?? null;
                else if (c.choices[field])
                    resolved[field] = (c.choices[field] === 'left' ? left : right).fields[field] ?? null;
            }
            const blockedReason =
                left.fields.composition !== right.fields.composition || !left.fields.composition
                    ? 'Составы отличаются или не подтверждены. Объединение недоступно до проверки состава.'
                    : null;
            const previewKey = JSON.stringify({ pairKey, canonicalId: c.canonicalId, resolved });
            view.comparison = {
                left,
                right,
                conflicts,
                resolved,
                canonicalId: c.canonicalId,
                previewKey,
                blockedReason,
            };
            if (command.action === 'compare') return view;
            if (!context.critical) throw new ContentMockError(403, 'Требуется критичное подтверждение.');
            if (blockedReason || conflicts.some((field) => !c.choices[field]) || command.data.previewKey !== previewKey)
                throw new ContentMockError(409, 'Разрешите все конфликты и обновите предпросмотр.');
            const canonical = c.canonicalId === left.id ? left : right;
            const alias = canonical === left ? right : left;
            const beforeSnapshot = JSON.stringify(view.comparison);
            canonical.fields = resolved;
            canonical.name = resolved.name ?? canonical.name;
            canonical.variants = [...new Set([...left.variants, ...right.variants])];
            canonical.sources = [...new Set([...left.sources, ...right.sources])];
            canonical.authors = [...new Set([...left.authors, ...right.authors])];
            canonical.version++;
            alias.aliasOf = canonical.id;
            alias.version++;
            state.tables.content_catalog_cards = view.cards.map((card) => ({
                id: card.id,
                payload: JSON.stringify(card),
            }));
            (state.tables.catalog_merges ??= []).push({
                id: crypto.randomUUID(),
                source_id: alias.id,
                target_id: canonical.id,
                reason: command.data.reason,
                before_snapshot: beforeSnapshot,
            });
            view.message =
                'Карточки объединены. Старый ID сохранён как ссылка; фасовки и исторические записи сохранены.';
            view.comparison = null;
            view.version++;
        }
    }
    view.history.push({
        action: command.action === 'moderate' ? command.data.action : command.action,
        reason: 'reason' in command.data ? command.data.reason : '',
        actor: context.actorId,
        at: new Date(context.now).toISOString(),
    });
    const storage = (state.tables.content_workspaces ??= []);
    const stored = storage.find((row) => row.id === id && row.section === section);
    if (stored) stored.payload = JSON.stringify(view);
    else storage.push({ id, section, payload: JSON.stringify(view) });
    if ('idempotencyKey' in command.data)
        journal.push({
            id: command.data.idempotencyKey,
            actor_id: context.actorId,
            digest,
            result: JSON.stringify(view),
        });
    (state.tables.audit_events ??= []).push({
        id: crypto.randomUUID(),
        actor_id: context.actorId,
        action: `admin.content.${command.action}`,
        target_id: id,
        created_at: new Date(context.now).toISOString(),
    });
    return view;
}
