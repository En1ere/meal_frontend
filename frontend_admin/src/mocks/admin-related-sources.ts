import type { AdminSection } from './admin-model.js';
export interface RelatedSource {
    table: string;
    label: string;
    title: string;
    status: string | null;
    fields: readonly (readonly [string, string])[];
}
export const relatedSources: Partial<Record<AdminSection, Record<string, RelatedSource>>> = {
    users: {
        roles: {
            table: 'staff_role_assignments',
            label: 'Служебные роли',
            title: 'role',
            status: null,
            fields: [
                ['assigned_at', 'Выдано'],
                ['revoked_at', 'Отозвано'],
                ['assigned_by', 'Выдал'],
            ],
        },
        sanctions: {
            table: 'sanctions',
            label: 'Санкции',
            title: 'scope',
            status: null,
            fields: [
                ['reason', 'Причина'],
                ['starts_at', 'Начало'],
                ['ends_at', 'Конец'],
                ['revoked_at', 'Снято'],
            ],
        },
        support: {
            table: 'support_tickets',
            label: 'Обращения пользователя',
            title: 'subject',
            status: 'status',
            fields: [
                ['category', 'Категория'],
                ['public_number', 'Номер'],
                ['closed_at', 'Закрыто'],
            ],
        },
        audit: {
            table: 'audit_events',
            label: 'События пользователя',
            title: 'action',
            status: null,
            fields: [
                ['target_type', 'Тип объекта'],
                ['target_id', 'Объект'],
                ['effective_at', 'Действует с'],
                ['recorded_at', 'Записано'],
            ],
        },
    },
    sanctions: {
        appeals: {
            table: 'appeals',
            label: 'Апелляции',
            title: 'status',
            status: 'status',
            fields: [
                ['body', 'Текст обращения'],
                ['submitted_at', 'Подано'],
                ['resolved_at', 'Рассмотрено'],
            ],
        },
    },
    subscriptions: {
        periods: {
            table: 'subscription_periods',
            label: 'Периоды подписки',
            title: 'grant_kind',
            status: null,
            fields: [
                ['starts_at', 'Начало'],
                ['ends_at', 'Конец'],
                ['order_id', 'Заказ'],
            ],
        },
        changes: {
            table: 'subscription_changes',
            label: 'Изменения подписки',
            title: 'kind',
            status: 'status',
            fields: [
                ['scheduled_at', 'Запланировано'],
                ['applied_at', 'Применено'],
                ['reason', 'Причина'],
                ['actor_id', 'Инициатор'],
            ],
        },
        coverage: {
            table: 'family_coverages',
            label: 'Семейное покрытие',
            title: 'reason',
            status: null,
            fields: [
                ['family_id', 'Семья'],
                ['starts_at', 'Начало'],
                ['ends_at', 'Конец'],
                ['selected_at', 'Выбрано'],
            ],
        },
        grace: {
            table: 'grace_incidents',
            label: 'Страховые периоды',
            title: 'reason',
            status: null,
            fields: [
                ['starts_at', 'Начало'],
                ['ends_at', 'Конец'],
                ['extended_at', 'Продлено'],
                ['extended_by', 'Сотрудник'],
            ],
        },
        'ai-buckets': {
            table: 'ai_buckets',
            label: 'AI-квоты подписки',
            title: 'kind',
            status: null,
            fields: [
                ['granted', 'Выдано'],
                ['balance_projection', 'Остаток'],
                ['reserved_projection', 'Зарезервировано'],
                ['expires_at', 'Истекает'],
            ],
        },
        'ai-ledger': {
            table: 'ai_ledger',
            label: 'Движения AI-квоты',
            title: 'kind',
            status: null,
            fields: [
                ['delta', 'Изменение'],
                ['reserved_delta', 'Изменение резерва'],
                ['recorded_at', 'Записано'],
                ['bucket_id', 'Квота'],
            ],
        },
    },
    families: {
        memberships: {
            table: 'family_memberships',
            label: 'Участники',
            title: 'user_id',
            status: null,
            fields: [
                ['joined_at', 'Вступил'],
                ['left_at', 'Вышел'],
                ['stable_order', 'Порядок'],
            ],
        },
        coverage: {
            table: 'family_coverages',
            label: 'Покрытие Plus',
            title: 'reason',
            status: null,
            fields: [
                ['subscription_id', 'Подписка'],
                ['starts_at', 'Начало'],
                ['ends_at', 'Конец'],
                ['selected_at', 'Выбрано'],
            ],
        },
    },
    payments: {
        attempts: {
            table: 'payment_attempts',
            label: 'Попытки оплаты',
            title: 'provider',
            status: 'status',
            fields: [['amount_minor', 'Сумма в минимальных единицах']],
        },
        reconciliations: {
            table: 'payment_reconciliations',
            label: 'Сверки',
            title: 'id',
            status: 'status',
            fields: [
                ['attempt_id', 'Попытка'],
                ['requested_at', 'Запрошено'],
                ['requested_by', 'Сотрудник'],
                ['reason', 'Причина'],
            ],
        },
        refunds: {
            table: 'payment_refunds',
            label: 'Возвраты',
            title: 'id',
            status: 'status',
            fields: [
                ['amount_minor', 'Сумма в минимальных единицах'],
                ['attempt_id', 'Попытка'],
                ['requested_by', 'Сотрудник'],
                ['reason', 'Причина'],
            ],
        },
        documents: {
            table: 'billing_documents',
            label: 'Платёжные документы',
            title: 'kind',
            status: null,
            fields: [
                ['issued_at', 'Выдан'],
                ['amount_minor', 'Сумма в минимальных единицах'],
            ],
        },
    },
    queues: {
        'recipe-revisions': {
            table: 'recipe_revisions',
            label: 'Редакции рецепта',
            title: 'title',
            status: null,
            fields: [
                ['revision', 'Редакция'],
                ['portions', 'Порции'],
                ['method', 'Способ'],
                ['change_kind', 'Изменение'],
                ['created_by', 'Автор'],
            ],
        },
        'catalog-revisions': {
            table: 'catalog_proposal_revisions',
            label: 'Редакции предложения каталога',
            title: 'revision',
            status: null,
            fields: [
                ['proposal_id', 'Предложение'],
                ['author_id', 'Автор'],
            ],
        },
        decisions: {
            table: 'moderation_decisions',
            label: 'Решения',
            title: 'action',
            status: null,
            fields: [
                ['reason', 'Причина'],
                ['decided_at', 'Решение принято'],
                ['actor_id', 'Сотрудник'],
            ],
        },
        claims: {
            table: 'moderation_claims',
            label: 'Назначения',
            title: 'outcome',
            status: null,
            fields: [
                ['staff_id', 'Сотрудник'],
                ['claimed_at', 'Взято'],
                ['lease_until', 'Захват до'],
                ['released_at', 'Освобождено'],
            ],
        },
    },
    catalog: {
        variants: {
            table: 'ingredient_variants',
            label: 'Вариант ингредиента',
            title: 'name',
            status: 'status',
            fields: [['ingredient_id', 'Ингредиент']],
        },
        barcodes: {
            table: 'product_barcodes',
            label: 'Штрихкоды',
            title: 'code',
            status: null,
            fields: [
                ['format', 'Формат'],
                ['verified_at', 'Проверено'],
            ],
        },
        compositions: {
            table: 'composition_versions',
            label: 'Состав и пищевая ценность',
            title: 'revision',
            status: null,
            fields: [
                ['composition_text', 'Состав'],
                ['kcal', 'Ккал'],
                ['protein', 'Белки'],
                ['fat', 'Жиры'],
                ['carbs', 'Углеводы'],
                ['basis_quantity', 'На количество'],
                ['basis_unit_id', 'Единица'],
                ['source', 'Источник'],
                ['confidence', 'Достоверность'],
            ],
        },
        merges: {
            table: 'catalog_merges',
            label: 'История объединений',
            title: 'kind',
            status: 'status',
            fields: [
                ['reason', 'Причина'],
                ['applied_at', 'Применено'],
                ['source_product_id', 'Исходный товар'],
                ['target_product_id', 'Итоговый товар'],
                ['actor_id', 'Сотрудник'],
            ],
        },
    },
    news: {
        campaigns: {
            table: 'mail_campaigns',
            label: 'Почтовые кампании',
            title: 'kind',
            status: 'status',
            fields: [
                ['scheduled_at', 'Запланировано'],
                ['created_by', 'Автор'],
            ],
        },
        deliveries: {
            table: 'notification_deliveries',
            label: 'Статусы доставки',
            title: 'channel',
            status: 'status',
            fields: [
                ['scheduled_at', 'Запланировано'],
                ['sent_at', 'Отправлено'],
                ['attempt_no', 'Попытка'],
            ],
        },
    },
    access: {
        roles: {
            table: 'staff_role_assignments',
            label: 'История ролей',
            title: 'role',
            status: null,
            fields: [
                ['assigned_at', 'Выдано'],
                ['revoked_at', 'Отозвано'],
                ['assigned_by', 'Выдал'],
            ],
        },
        grants: {
            table: 'staff_grants',
            label: 'Служебные разрешения',
            title: 'permission',
            status: null,
            fields: [
                ['scope', 'Область'],
                ['valid_until', 'Действует до'],
                ['revoked_at', 'Отозвано'],
                ['granted_by', 'Выдал'],
            ],
        },
        sessions: {
            table: 'sessions',
            label: 'Служебные сессии',
            title: 'auth_context',
            status: null,
            fields: [
                ['authenticated_at', 'Вход'],
                ['mfa_verified_at', 'MFA'],
                ['expires_at', 'Истекает'],
                ['revoked_at', 'Отозвана'],
            ],
        },
    },
    'legal-requests': {
        steps: {
            table: 'legal_request_steps',
            label: 'Этапы правового запроса',
            title: 'kind',
            status: 'status',
            fields: [
                ['completed_at', 'Завершено'],
                ['approved_by', 'Согласовал'],
            ],
        },
    },
    rollback: {
        items: {
            table: 'compensation_items',
            label: 'Элементы компенсации',
            title: 'id',
            status: 'status',
            fields: [
                ['source_event_id', 'Исходное событие'],
                ['result_event_id', 'Итоговое событие'],
            ],
        },
    },
    operations: {
        attempts: {
            table: 'job_attempts',
            label: 'Попытки выполнения',
            title: 'attempt_no',
            status: null,
            fields: [
                ['started_at', 'Начало'],
                ['finished_at', 'Завершение'],
            ],
        },
    },
    support: {
        events: {
            table: 'support_events',
            label: 'История обращения и назначения',
            title: 'kind',
            status: null,
            fields: [
                ['recorded_at', 'Записано'],
                ['actor_id', 'Сотрудник'],
                ['reason', 'Причина'],
            ],
        },
    },
};
