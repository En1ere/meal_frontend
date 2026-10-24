import { useCallback } from 'react';
import { useRuntime } from '../../app/providers.js';
import { ContentWorkspace } from './content-workspace.js';
import type { ContentCommand, ContentResult } from './contracts.js';
export function ContentPanel({ section, id }: { section: 'queues' | 'catalog'; id: string }) {
    const { api } = useRuntime();
    const request = useCallback(
        async (command: ContentCommand, signal?: AbortSignal): Promise<ContentResult> => {
            if (!api) throw new Error('Подключение не готово');
            if (command.action === 'load')
                return (
                    await api.request('GET /api/v1/admin/content-workspace/{section}/{id}', undefined, signal, {
                        section,
                        id,
                    })
                ).data;
            return (
                await api.request(
                    `POST /api/v1/admin/content-workspace/{section}/{id}/${command.action}`,
                    command.data,
                    signal,
                    { section, id },
                )
            ).data;
        },
        [api, section, id],
    );
    return <ContentWorkspace section={section} id={id} api={request} />;
}
