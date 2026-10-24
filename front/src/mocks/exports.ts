import { z } from 'zod';
import { contracts } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';
import { consumeCriticalReauth } from './account-lifecycle.js';
import { mockDiaryAccess } from './diary.js';

const previewSchema = contracts['POST /api/v1/exports/preview'].success.shape.data;
const jobSchema = contracts['POST /api/v1/exports'].success.shape.data.shape.job;

export const exportsStateSchema = z.object({
    previews: z.array(z.object({ userId: z.string(), input: z.string(), preview: previewSchema })),
    jobs: z.array(z.object({ userId: z.string(), job: jobSchema, content: z.string() })),
    replay: z.record(z.string(), z.object({ input: z.string(), jobId: z.string() })),
});

export type ExportsState = z.infer<typeof exportsStateSchema>;
export const createExportsState = (): ExportsState => ({ previews: [], jobs: [], replay: {} });

const listQuerySchema = z
    .object({
        cursor: z.string().max(2000).regex(/^\d+$/).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict();

const privateSections = [
    {
        code: 'identity' as const,
        label: 'Аккаунт',
        detail: 'Логин, имя и подтверждённый адрес.',
        ownership: 'requester' as const,
    },
    {
        code: 'profile' as const,
        label: 'Профиль',
        detail: 'Личные профильные данные.',
        ownership: 'requester' as const,
    },
    {
        code: 'preferences' as const,
        label: 'Предпочтения',
        detail: 'Ваши настройки питания, аллергены, цели и оборудование.',
        ownership: 'requester' as const,
    },
    {
        code: 'consents' as const,
        label: 'Согласия',
        detail: 'История ваших согласий и отзывов.',
        ownership: 'requester' as const,
    },
    {
        code: 'inventory' as const,
        label: 'Личные запасы',
        detail: 'Только ваши личные партии продуктов; семейные данные не включаются.',
        ownership: 'requester' as const,
    },
    {
        code: 'recipes' as const,
        label: 'Рецепты',
        detail: 'Авторские черновики, версии и публикации.',
        ownership: 'requester' as const,
    },
    {
        code: 'cooking' as const,
        label: 'Готовка',
        detail: 'Ваши попытки и прогресс.',
        ownership: 'requester' as const,
    },
    {
        code: 'preserves' as const,
        label: 'Заготовки',
        detail: 'Личные заготовки и контейнеры.',
        ownership: 'requester' as const,
    },
    {
        code: 'meal_plans' as const,
        label: 'Планы',
        detail: 'Личные планы и порции.',
        ownership: 'requester' as const,
    },
    {
        code: 'shopping' as const,
        label: 'Покупки',
        detail: 'Списки, покупки и распознанные данные чеков.',
        ownership: 'requester' as const,
    },
    {
        code: 'notifications' as const,
        label: 'Уведомления',
        detail: 'Настройки и безопасная история уведомлений.',
        ownership: 'requester' as const,
    },
    {
        code: 'community' as const,
        label: 'Сообщество',
        detail: 'Ваши оценки, комментарии, подписки и закладки.',
        ownership: 'requester' as const,
    },
    {
        code: 'support' as const,
        label: 'Поддержка',
        detail: 'Ваши обращения и доступные вам сообщения.',
        ownership: 'requester' as const,
    },
    {
        code: 'ai_history' as const,
        label: 'AI',
        detail: 'Ваши запросы и сохранённые результаты без provider payload.',
        ownership: 'requester' as const,
    },
    {
        code: 'subscription_metadata' as const,
        label: 'Подписка',
        detail: 'Статусы продукта и периоды без платёжных документов.',
        ownership: 'requester' as const,
    },
];

const familySections = [
    ['family_profile', 'Семья', 'Название и общие настройки семьи.'],
    ['family_memberships', 'Участники', 'Общая история состава без чужих приватных данных.'],
    ['family_inventory', 'Семейные запасы', 'Общие партии, места и движения.'],
    ['family_recipes', 'Семейные рецепты', 'Доступные семье рецепты и версии.'],
    ['family_preserves', 'Семейные заготовки', 'Общие заготовки и контейнеры.'],
    ['family_meal_plans', 'Семейные планы', 'Общие планы и распределение порций.'],
    ['family_shopping', 'Семейные покупки', 'Общие списки и покупки.'],
    ['family_notes', 'Семейные заметки', 'Общие заметки и история редакций.'],
    ['family_chat', 'Семейный чат', 'Сообщения, доступные заявителю по периоду членства.'],
].map(([code, label, detail]) => ({ code, label, detail, ownership: 'shared_family' as const }));

const proSections = {
    diary: [
        ['diary_entries', 'Дневник', 'Личные записи дневника, компоненты и состояния.'],
        ['diary_portions', 'Порции', 'Личные назначения порций и принятые решения.'],
    ],
    finance: [
        ['finance_expenses', 'Расходы', 'Личные расходы и их источники.'],
        ['finance_budgets', 'Бюджеты', 'Личные бюджетные периоды и лимиты.'],
        ['finance_prices', 'Цены', 'Личные наблюдения цен и их происхождение.'],
        ['finance_receipts', 'Чеки', 'Доступные личные финансовые данные чеков.'],
    ],
    nutrition: [
        ['nutrition_profile', 'Профиль питания', 'Сохранённый личный профиль.'],
        ['nutrition_targets', 'Цели и КБЖУ', 'История ручных целей и сохранённые значения.'],
    ],
} as const;

const selectedProSections = (domain: 'diary' | 'finance' | 'nutrition' | 'all_pro_data') => {
    const rows =
        domain === 'all_pro_data'
            ? [...proSections.diary, ...proSections.finance, ...proSections.nutrition]
            : proSections[domain];
    return rows.map(([code, label, detail]) => ({ code, label, detail, ownership: 'requester' as const }));
};

function advance(job: z.infer<typeof jobSchema>, now: number) {
    const requested = Date.parse(job.requestedAt);
    const readyAt = requested + 2000;
    const expiresAt = job.expiresAt ? Date.parse(job.expiresAt) : readyAt + 24 * 60 * 60_000;
    if (job.status === 'failed' || job.status === 'expired') return job.status === 'expired';
    if (job.status === 'ready' && now < expiresAt) return false;
    if (now >= expiresAt) {
        job.status = 'expired';
        job.completedAt ??= new Date(readyAt).toISOString();
        job.expiresAt ??= new Date(expiresAt).toISOString();
        return true;
    }
    if (now >= readyAt) {
        job.status = 'failed';
        job.completedAt ??= new Date(readyAt).toISOString();
        job.expiresAt = null;
        job.failureCode = 'storage_unavailable';
    } else if (now >= requested + 600) job.status = 'processing';
    return false;
}

export function exportsHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    params: Record<string, string>;
    method: string;
    query: URLSearchParams;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}): Response | null {
    const { state, userId, path, params, method, query, input, now, success, fail } = c;
    if (!path.startsWith('/api/v1/exports')) return null;
    if (!userId) return fail(401);

    if (path === '/api/v1/exports/preview' && method === 'POST') {
        const parsed = contracts['POST /api/v1/exports/preview'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        if (parsed.data.startsOn && parsed.data.endsOn && parsed.data.startsOn > parsed.data.endsOn) return fail(400);
        const proDomain = parsed.data.domain !== 'personal_data';
        const family = parsed.data.scope === 'family';
        const activeFamily = state.family.families.find(
            (candidate) =>
                !candidate.archived &&
                candidate.members.some((member) => member.userId === userId && member.leftAt === null),
        );
        const access = proDomain ? mockDiaryAccess(state, userId, now) : null;
        const blockers = [
            ...(family && !activeFamily
                ? [
                      {
                          code: 'family_membership_required' as const,
                          message: 'Для семейного экспорта требуется актуальное участие в семье.',
                      },
                  ]
                : []),
            ...(proDomain && access?.mode !== 'active'
                ? [
                      {
                          code: 'active_pro_required' as const,
                          message:
                              'Новый Pro-экспорт доступен только при активном Pro. Готовая история остаётся доступной для чтения.',
                      },
                  ]
                : []),
        ];
        const today = new Date(now).toISOString().slice(0, 10);
        const periodEnd = access?.periodEndsAt?.slice(0, 10) ?? null;
        const dataThrough = [parsed.data.endsOn, today, periodEnd]
            .filter((value): value is string => !!value)
            .sort()[0]!;
        const manifest = blockers.length
            ? null
            : {
                  schemaVersion: '2026-10-09' as const,
                  selection: parsed.data,
                  scopeId: family ? activeFamily!.id : userId,
                  familyId: family ? activeFamily!.id : null,
                  requesterId: userId,
                  sections:
                      parsed.data.domain !== 'personal_data'
                          ? selectedProSections(parsed.data.domain)
                          : family
                            ? familySections
                            : privateSections,
                  exclusions: [
                      ...(family
                          ? [
                                {
                                    code: 'other_members_private_data' as const,
                                    message: 'Личные данные других участников семьи не включаются.',
                                },
                            ]
                          : []),
                      {
                          code: 'credentials' as const,
                          message: 'Пароли и другие секреты аутентификации не включаются.',
                      },
                      {
                          code: 'internal_audit' as const,
                          message: 'Внутренний аудит и служебные расследования не входят в архив.',
                      },
                      {
                          code: 'payment_documents' as const,
                          message: 'Платёжные документы выдаются отдельным регулируемым процессом.',
                      },
                      {
                          code: 'binary_assets' as const,
                          message: 'Бинарные оригиналы не включаются без защищённого хранилища.',
                      },
                  ],
                  aclSnapshotAt: new Date(now).toISOString(),
                  proAccess:
                      proDomain && access?.mode === 'active'
                          ? {
                                modeAtPreview: 'active' as const,
                                source: access.source,
                                periodEndsAt: access.periodEndsAt,
                                dataThrough,
                                checkedAt: new Date(now).toISOString(),
                            }
                          : null,
              };
        const preview = previewSchema.parse({
            previewId: crypto.randomUUID(),
            manifest,
            canCreate: !!manifest,
            blockers,
            expiresAt: new Date(now + 10 * 60_000).toISOString(),
        });
        state.exports.previews.push({ userId, input: JSON.stringify(parsed.data), preview });
        return success(preview);
    }

    if (path === '/api/v1/exports' && method === 'POST') {
        const parsed = contracts['POST /api/v1/exports'].request.safeParse(input);
        if (!parsed.success) return fail(400);
        const preview = state.exports.previews.find(
            (row) => row.userId === userId && row.preview.previewId === parsed.data.previewId,
        )?.preview;
        if (!preview || !preview.manifest || Date.parse(preview.expiresAt) <= now || !preview.canCreate)
            return fail(409);
        const currentAccess = mockDiaryAccess(state, userId, now);
        if (preview.manifest.selection.domain !== 'personal_data' && currentAccess?.mode !== 'active')
            return fail(403, 'PRO_READ_ONLY');
        if (
            preview.manifest.selection.scope === 'family' &&
            !state.family.families.some(
                (candidate) =>
                    candidate.id === preview.manifest!.familyId &&
                    !candidate.archived &&
                    candidate.members.some((member) => member.userId === userId && member.leftAt === null),
            )
        )
            return fail(403, 'FAMILY_ACCESS_REVOKED');
        const replayKey = `${userId}:${parsed.data.idempotencyKey}`;
        const serialized = JSON.stringify(parsed.data);
        const replay = state.exports.replay[replayKey];
        if (replay) {
            if (replay.input !== serialized) return fail(409);
            const old = state.exports.jobs.find((row) => row.userId === userId && row.job.id === replay.jobId);
            if (old && advance(old.job, now)) old.content = '';
            return old ? success({ job: old.job }) : fail(409);
        }
        if (!consumeCriticalReauth(state, userId, parsed.data.reauthToken, 'export', now))
            return fail(401, 'REAUTH_EXPIRED');
        const job = jobSchema.parse({
            id: crypto.randomUUID(),
            manifest: preview.manifest,
            requestedAt: new Date(now).toISOString(),
            status: 'queued',
            completedAt: null,
            expiresAt: null,
            failureCode: null,
        });
        state.exports.jobs.push({
            userId,
            job,
            content: '',
        });
        state.exports.replay[replayKey] = { input: serialized, jobId: job.id };
        return success({ job });
    }

    if (path === '/api/v1/exports' && method === 'GET') {
        const parsed = listQuerySchema.safeParse(Object.fromEntries(query));
        if (!parsed.success) return fail(400);
        const offset = parsed.data.cursor ? Number(parsed.data.cursor) : 0;
        const own = state.exports.jobs
            .filter((row) => row.userId === userId)
            .sort((left, right) => right.job.requestedAt.localeCompare(left.job.requestedAt));
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > own.length) return fail(400);
        own.forEach((row) => {
            if (advance(row.job, now)) row.content = '';
        });
        const items = own.slice(offset, offset + parsed.data.limit).map((row) => row.job);
        const nextOffset = offset + parsed.data.limit;
        return success({ items, nextCursor: nextOffset < own.length ? String(nextOffset) : null });
    }

    if (/^\/api\/v1\/exports\/[^/]+\/download-content$/.test(path) && method === 'GET') {
        const row = state.exports.jobs.find(
            (candidate) => candidate.userId === userId && candidate.job.id === params.id,
        );
        if (!row) return fail(404);
        if (advance(row.job, now)) row.content = '';
        if (row.job.status !== 'ready') return fail(409);
        return fail(503, 'EXPORT_STORAGE_UNAVAILABLE');
    }

    return fail(404);
}
