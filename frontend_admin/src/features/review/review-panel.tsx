import { useCallback } from 'react';
import { useRuntime } from '../../app/providers.js';
import { ReviewWorkspace } from './review-workspace.js';
import type { ReviewCommand, ReviewResult } from './contracts.js';
export function ReviewPanel({ section, id }: { section: 'legal-requests' | 'rollback'; id: string }) {
    const { api } = useRuntime();
    const request = useCallback(
        async (command: ReviewCommand, signal?: AbortSignal): Promise<ReviewResult> => {
            if (!api) throw new Error('Подключение не готово');
            if (command.action === 'load')
                return (
                    await api.request('GET /api/v1/admin/review-workspace/{section}/{id}', undefined, signal, {
                        section,
                        id,
                    })
                ).data;
            return (
                await api.request(
                    `POST /api/v1/admin/review-workspace/{section}/{id}/${command.action}`,
                    command.data,
                    signal,
                    { section, id },
                )
            ).data;
        },
        [api, section, id],
    );
    return <ReviewWorkspace section={section} id={id} api={request} />;
}
