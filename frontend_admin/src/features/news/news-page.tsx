import { useCallback } from 'react';
import { useRuntime } from '../../app/providers.js';
import { Guard } from '../auth/session.js';
import { AdminShell } from '../admin/admin-shell.js';
import { NewsWorkspace, type NewsApi } from './news-workspace.js';

export function NewsPage() {
    const { api } = useRuntime();
    const request = useCallback<NewsApi>(
        async (command, signal) => {
            if (!api) throw new Error('Подключение не готово');
            if (command.action === 'list')
                return (await api.request('GET /api/v1/admin/news-workspace', undefined, signal)).data;
            const route = `POST /api/v1/admin/news-workspace/${command.action}` as const;
            return (await api.request(route, command, signal)).data;
        },
        [api],
    );
    return (
        <Guard context="admin">
            <AdminShell active="news">
                <h1>Новости</h1>
                <NewsWorkspace api={request} />
            </AdminShell>
        </Guard>
    );
}
