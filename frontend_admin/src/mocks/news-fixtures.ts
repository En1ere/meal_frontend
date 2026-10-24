import type { AdminState } from './admin-model.js';
import type { NewsContent, NewsItem } from '../features/news/contracts.js';
export function ensureNewsFixtures(state: AdminState) {
    if (state.tables.news_workspace !== undefined) return;
    const content: NewsContent = {
        type: 'important',
        title: 'Тестовая новость: планирование семейного меню',
        pages: [
            {
                blocks: [
                    {
                        kind: 'text',
                        text: 'Это демонстрационный материал. Проверьте предпросмотр, выбор аудитории и тестовую отправку.',
                    },
                ],
            },
            { blocks: [{ kind: 'text', text: 'Вторая страница важного объявления.' }] },
        ],
        sources: [],
        audience: {
            plans: [],
            genders: [],
            families: [],
            registeredFrom: null,
            registeredTo: null,
            activeFrom: null,
            activeTo: null,
        },
        channels: ['in_app'],
        category: 'service',
    };
    const items: NewsItem[] = (['draft', 'published', 'scheduled'] as const).map((status, index) => ({
        id: `73000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        version: 1,
        content: {
            ...structuredClone(content),
            title: `${['Черновик', 'Опубликовано', 'По расписанию'][index]} · ${content.title}`,
        },
        status,
        scheduledAt: status === 'scheduled' ? '2099-01-01T08:00:00.000Z' : null,
        history: [],
    }));
    state.tables.news_workspace = items.map((item) => ({ id: item.id, payload: JSON.stringify(item) }));
}
