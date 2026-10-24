import {
    reviewExecuteSchema,
    reviewPreviewSchema,
    reviewResultSchema,
    type ReviewCommand,
    type ReviewResult,
} from '../features/review/contracts.js';
import type { AdminState } from './admin-model.js';
import { applyMockRollback, inspectMockRollback } from './rollback-registry.js';

export class ReviewMockError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
const fixtureId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function ensureReviewFixtures(state: AdminState) {
    if (state.tables.review_fixture_marker) return;
    state.tables.review_fixture_marker = [{ id: '1' }];
    const original = state.tables.legal_requests?.[0];
    if (original) {
        (state.tables.legal_requests ??= []).push({
            ...original,
            id: fixtureId(112),
            version: '1',
            status: 'identity_verified',
        });
        (state.tables.legal_request_steps ??= []).push({
            id: fixtureId(113),
            request_id: fixtureId(112),
            kind: 'identity',
            status: 'completed',
            evidence: 'Синтетический пример: повторная аутентификация заявителя подтверждена',
            completed_at: '2026-09-28T08:00:00.000Z',
        });
    }
    state.tables.review_rollback_targets = [
        { id: fixtureId(114), adapter: 'content-release', state_snapshot: JSON.stringify('published'), version: 2 },
        { id: fixtureId(115), adapter: 'moderation', state_snapshot: JSON.stringify('unpublish'), version: 4 },
        {
            id: fixtureId(119),
            adapter: 'sanction',
            state_snapshot: JSON.stringify({ revokedAt: '2026-09-28T08:00:00.000Z', endsAt: null }),
            version: 3,
        },
        {
            id: fixtureId(120),
            adapter: 'settings.recipe-policy',
            state_snapshot: JSON.stringify({
                submissionDailyLimit: 8,
                commentHourlyLimit: 20,
                reportDailyLimit: 5,
            }),
            version: 5,
        },
        { id: fixtureId(121), adapter: 'external-delivery', state_snapshot: JSON.stringify('delivered'), version: 1 },
    ];
    state.tables.review_rollback_items = [
        {
            id: fixtureId(116),
            target_id: fixtureId(114),
            adapter: 'content-release',
            before_snapshot: JSON.stringify('draft'),
            after_snapshot: JSON.stringify('published'),
            expected_version: 2,
        },
        {
            id: fixtureId(117),
            target_id: fixtureId(115),
            adapter: 'moderation',
            before_snapshot: JSON.stringify('published'),
            after_snapshot: JSON.stringify('unpublish'),
            expected_version: 2,
        },
        {
            id: fixtureId(118),
            target_id: fixtureId(119),
            adapter: 'sanction',
            before_snapshot: JSON.stringify({ revokedAt: null, endsAt: null }),
            after_snapshot: JSON.stringify({ revokedAt: '2026-09-28T08:00:00.000Z', endsAt: null }),
            expected_version: 3,
        },
        {
            id: fixtureId(122),
            target_id: fixtureId(120),
            adapter: 'settings.recipe-policy',
            before_snapshot: JSON.stringify({
                submissionDailyLimit: 5,
                commentHourlyLimit: 15,
                reportDailyLimit: 3,
            }),
            after_snapshot: JSON.stringify({
                submissionDailyLimit: 8,
                commentHourlyLimit: 20,
                reportDailyLimit: 5,
            }),
            expected_version: 5,
        },
        {
            id: fixtureId(123),
            target_id: fixtureId(121),
            adapter: 'external-delivery',
            before_snapshot: JSON.stringify('queued'),
            after_snapshot: JSON.stringify('delivered'),
            expected_version: 1,
        },
    ];
}
function load(state: AdminState, section: 'legal-requests' | 'rollback', id: string, now: number): ReviewResult {
    ensureReviewFixtures(state);
    const row = state.tables[section === 'rollback' ? 'compensation_requests' : 'legal_requests']?.find(
        (value) => value.id === id,
    );
    if (!row) throw new ReviewMockError(404, 'Запрос не найден.');
    const stored = state.tables.review_workspaces?.find((value) => value.id === id && value.section === section);
    const evidence = state.tables.legal_request_steps?.find(
        (value) => value.request_id === id && value.kind === 'identity' && value.status === 'completed',
    );
    const base: ReviewResult = stored
        ? reviewResultSchema.parse(JSON.parse(String(stored.payload)))
        : {
              section,
              id,
              version: Number(row.version ?? 1),
              status: String(row.status),
              requesterId: row.user_id ? String(row.user_id) : null,
              identityVerified: !!evidence,
              identityEvidence: evidence?.evidence ? String(evidence.evidence) : null,
              dependencies:
                  section === 'legal-requests'
                      ? [
                            {
                                label: 'Проверка заявителя',
                                state: evidence ? 'ready' : 'blocked',
                                detail: evidence
                                    ? String(evidence.evidence)
                                    : 'Ожидается подтверждённое событие повторной аутентификации или ручной проверки поддержки.',
                            },
                            {
                                label: 'Владение семьёй',
                                state: 'info',
                                detail: 'Для удаления требуется передать владение. Экспорт содержит только данные заявителя.',
                            },
                            {
                                label: 'Подписки и платежи',
                                state: 'info',
                                detail: 'Оплаченные периоды, обязательства и история платежей сохраняются до отдельного решения.',
                            },
                            {
                                label: 'Общий контент',
                                state: 'info',
                                detail: 'Исторические данные других участников семьи не удаляются.',
                            },
                            {
                                label: 'Политика хранения',
                                state: 'blocked',
                                detail: 'Окончательное удаление заблокировано: сроки хранения аккаунтов, платежей, аудита, обращений и резервных копий ещё не утверждены.',
                            },
                        ]
                      : [],
              exportData: null,
              items: [],
              history: [],
              previewKey: null,
              message: '',
              relatedRequests:
                  section === 'legal-requests'
                      ? [
                            { id: fixtureId(12), label: 'Ожидает проверки заявителя (тестовый пример)' },
                            { id: fixtureId(112), label: 'Заявитель подтверждён (тестовый пример)' },
                        ]
                      : [],
          };
    base.previewKey = null;
    base.identityVerified = !!evidence;
    base.identityEvidence = evidence?.evidence ? String(evidence.evidence) : null;
    base.message = '';
    if (base.exportData && Date.parse(base.exportData.expiresAt) <= now) {
        base.exportData.status = 'expired';
        state.tables.review_export_files = (state.tables.review_export_files ?? []).filter(
            (file) => file.id !== base.exportData?.id,
        );
    }
    if (section === 'rollback')
        base.items = (state.tables.review_rollback_items ?? []).map((item) => {
            const target = state.tables.review_rollback_targets?.find((value) => value.id === item.target_id);
            const inspection = inspectMockRollback(item, target);
            const applied = state.tables.review_applied_items?.some(
                (value) => value.id === item.id && value.request_id === id,
            );
            return {
                id: String(item.id),
                targetId: inspection.targetId,
                before: inspection.before,
                after: inspection.after,
                current: inspection.current,
                expectedVersion: inspection.expectedVersion,
                actualVersion: inspection.actualVersion,
                state: applied
                    ? 'applied'
                    : !inspection.supported
                      ? 'blocked'
                      : inspection.ready
                        ? 'ready'
                        : 'conflict',
                reason: applied ? 'Компенсирующая операция уже выполнена.' : inspection.reason,
            };
        });
    return base;
}
function previewKey(view: ReviewResult) {
    return JSON.stringify({ id: view.id, version: view.version, identity: view.identityVerified, items: view.items });
}
export function reviewWorkspaceCommand(
    state: AdminState,
    section: 'legal-requests' | 'rollback',
    id: string,
    command: ReviewCommand,
    context: { actorId: string; critical: boolean; now: number },
): ReviewResult {
    const view = load(state, section, id, context.now);
    if (command.action === 'load') return view;
    const parsed = (command.action === 'preview' ? reviewPreviewSchema : reviewExecuteSchema).safeParse(command.data);
    if (!parsed.success) throw new ReviewMockError(400, 'Проверьте поля команды.');
    if (command.action === 'prepare-export') {
        if (section !== 'legal-requests') throw new ReviewMockError(409, 'Команда недоступна для раздела.');
        throw new ReviewMockError(503, 'Подготовка архива недоступна до подключения защищённого хранилища.');
    }
    const journal = (state.tables.review_commands ??= []);
    const digest = JSON.stringify({ section, id, command });
    if (command.action !== 'preview') {
        const key = command.data.idempotencyKey;
        const previous = journal.find((value) => value.id === key && value.actor_id === context.actorId);
        if (previous) {
            if (previous.digest !== digest) throw new ReviewMockError(409, 'Ключ команды уже использован.');
            const replay = reviewResultSchema.parse(JSON.parse(String(previous.result)));
            if (replay.exportData && Date.parse(replay.exportData.expiresAt) <= context.now)
                replay.exportData.status = 'expired';
            return replay;
        }
    }
    if (command.data.version !== view.version)
        throw new ReviewMockError(409, 'Запрос изменился. Обновите предпросмотр.');
    const preview = previewKey(view);
    if (command.action === 'preview') return { ...view, previewKey: preview };
    if (command.data.previewKey !== preview)
        throw new ReviewMockError(409, 'Последствия изменились. Повторите предпросмотр.');
    if (section !== 'rollback') throw new ReviewMockError(400, 'Неверный раздел.');
    if (!context.critical) throw new ReviewMockError(403, 'Требуется критичное подтверждение.');
    const ready = view.items.filter((item) => item.state === 'ready');
    if (!ready.length) throw new ReviewMockError(409, 'Нет элементов, которые можно безопасно компенсировать.');
    for (const item of ready) {
        const target = state.tables.review_rollback_targets!.find((value) => value.id === item.targetId)!;
        const source = state.tables.review_rollback_items!.find((value) => value.id === item.id)!;
        applyMockRollback(source, target);
        (state.tables.review_applied_items ??= []).push({
            id: item.id,
            request_id: id,
            before: item.current,
            after: item.before,
            actor_id: context.actorId,
            reason: command.data.reason,
        });
        item.state = 'applied';
        item.current = item.before;
        item.actualVersion++;
    }
    view.status = view.items.every((item) => item.state === 'applied') ? 'completed' : 'partial';
    view.message = `Компенсировано: ${ready.length}. Пропущено конфликтных и неподдержанных: ${view.items.filter((item) => item.state !== 'applied').length}.`;
    view.version++;
    view.previewKey = null;
    view.history.push({
        action: command.action,
        actor: context.actorId,
        reason: command.data.reason,
        at: new Date(context.now).toISOString(),
    });
    const storage = (state.tables.review_workspaces ??= []);
    const stored = storage.find((value) => value.id === id && value.section === section);
    if (stored) stored.payload = JSON.stringify(view);
    else storage.push({ id, section, payload: JSON.stringify(view) });
    journal.push({ id: command.data.idempotencyKey, actor_id: context.actorId, digest, result: JSON.stringify(view) });
    (state.tables.audit_events ??= []).push({
        id: crypto.randomUUID(),
        action: `admin.review.${command.action}`,
        actor_id: context.actorId,
        target_id: id,
        created_at: new Date(context.now).toISOString(),
        reason: command.data.reason,
    });
    return view;
}
