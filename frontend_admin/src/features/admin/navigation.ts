export const sections = [
    { id: 'overview', title: 'Обзор', group: 'Работа', description: 'Задачи и состояние сервисов.' },
    { id: 'queues', title: 'Очереди', group: 'Работа', description: 'Материалы, которые требуют проверки.' },
    { id: 'support', title: 'Поддержка', group: 'Работа', description: 'Обращения и переписка с пользователями.' },
    {
        id: 'users',
        title: 'Пользователи',
        group: 'Пользователи и доступ',
        description: 'Поиск по точному идентификатору или логину.',
    },
    {
        id: 'sanctions',
        title: 'Санкции',
        group: 'Пользователи и доступ',
        description: 'Ограничения, основания и история.',
    },
    { id: 'access', title: 'Доступ', group: 'Пользователи и доступ', description: 'Служебные роли и разрешения.' },
    {
        id: 'subscriptions',
        title: 'Подписки',
        group: 'Подписки и платежи',
        description: 'Периоды подписок, доступ и квоты.',
    },
    {
        id: 'families',
        title: 'Семьи',
        group: 'Подписки и платежи',
        description: 'Состав, владелец и семейное покрытие Plus.',
    },
    { id: 'payments', title: 'Платежи', group: 'Подписки и платежи', description: 'Платежи и результаты проверки.' },
    { id: 'catalog', title: 'Каталог', group: 'Контент', description: 'Товары, варианты и возможные дубли.' },
    {
        id: 'releases',
        title: 'Релизы',
        group: 'Контент',
        description: 'Пакеты изменений контента и история публикаций.',
    },
    { id: 'news', title: 'Новости', group: 'Контент', description: 'Публикации и рассылки.' },
    { id: 'audit', title: 'Аудит', group: 'Контроль', description: 'Неизменяемая история служебных действий.' },
    {
        id: 'rollback',
        title: 'Откат',
        group: 'Контроль',
        description: 'История действий и проверка возможности компенсации.',
    },
    {
        id: 'legal-requests',
        title: 'Правовые запросы',
        group: 'Контроль',
        description: 'Экспорт, удаление и условия исполнения.',
    },
    { id: 'operations', title: 'Операции', group: 'Система', description: 'Состояние фоновых процессов.' },
    { id: 'errors', title: 'Ошибки', group: 'Система', description: 'Безопасная диагностика событий приложения.' },
    { id: 'metrics', title: 'Метрики', group: 'Система', description: 'Проверенные показатели работы сервиса.' },
] as const;
export type Section = (typeof sections)[number]['id'];
export const sectionPath = (section: Section) =>
    section === 'overview' ? '/admin' : section === 'queues' ? '/admin/queues/recipes' : `/admin/${section}`;
export const detailPath = (section: Section, id: string) =>
    section === 'queues'
        ? `/admin/moderation/${encodeURIComponent(id)}`
        : section === 'operations'
          ? `/admin/operations/jobs/${encodeURIComponent(id)}`
          : `/admin/${section}/${encodeURIComponent(id)}`;
export function findSection(value: string | undefined) {
    return sections.find((section) => section.id === (value ?? 'overview'));
}
