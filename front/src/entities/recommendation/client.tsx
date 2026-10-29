'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSession } from '../session/client.js';
import { useRuntime } from '../../shared/runtime/index.js';
import type { Success } from '../../shared/api/contracts.generated.js';

export type Recommendation = Success<'GET /api/v1/recommendations'>['data']['items'][number];
export type RecommendationSurface = 'home' | 'recipes' | 'authors';

const impressions = new Set<string>();

function target(item: Recommendation) {
    return item.type === 'recipe'
        ? { entityType: 'recipe' as const, entityId: item.recipe.id }
        : { entityType: 'author' as const, entityId: item.author.username };
}

export function useRecommendationActions(item: Recommendation, surface: RecommendationSurface, position: number) {
    const { api } = useRuntime();
    const session = useSession('user');
    const [hidden, setHidden] = useState(false);
    const base = useMemo(
        () => ({
            recommendationId: item.recommendationId,
            ...target(item),
            algorithm: item.algorithmVersion,
            surface,
            position,
            reasonCodes: item.reasonCodes,
        }),
        [item, position, surface],
    );
    const send = (event: 'impression' | 'open' | 'not_interested' | 'not_suitable') => {
        if (!api) return Promise.resolve();
        return api
            .request('POST /api/v1/recommendations/events', {
                ...base,
                event,
                idempotencyKey: crypto.randomUUID(),
            })
            .then(() => undefined);
    };
    useEffect(() => {
        const key = `${session.data?.id ?? 'anonymous'}:${surface}:${item.recommendationId}:${position}`;
        if (!api || impressions.has(key)) return;
        impressions.add(key);
        void send('impression').catch(() => impressions.delete(key));
        // base changes exactly when this recommendation placement changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, item.recommendationId, position, session.data?.id, surface]);
    const feedback = useMutation({
        mutationFn: (event: 'not_interested' | 'not_suitable') => send(event),
        onSuccess: () => setHidden(true),
    });
    return {
        hidden,
        pending: feedback.isPending,
        error: feedback.isError,
        open: () => void send('open').catch(() => undefined),
        dismiss: (event: 'not_interested' | 'not_suitable') => feedback.mutate(event),
    };
}

export function RecommendationFeedback({
    actions,
    className,
}: {
    actions: ReturnType<typeof useRecommendationActions>;
    className?: string | undefined;
}) {
    return (
        <div className={className} aria-label="Настроить рекомендации">
            <button
                type="button"
                className="button outline"
                disabled={actions.pending}
                onClick={() => actions.dismiss('not_interested')}
            >
                Не интересно
            </button>
            <button
                type="button"
                className="button outline"
                disabled={actions.pending}
                onClick={() => actions.dismiss('not_suitable')}
            >
                Не подходит
            </button>
            {actions.error && <small role="alert">Не удалось сохранить выбор</small>}
        </div>
    );
}

export function FollowAuthorButton({ username }: { username: string }) {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const own = useQuery({
        queryKey: ['profile', 'own', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/profile', undefined, signal)).data.profile,
    });
    const key = ['author-follow', session.data?.id, username];
    const query = useQuery({
        queryKey: key,
        enabled: !!api && !!session.data && !!own.data && own.data.username !== username,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/authors/{username}/follow', undefined, signal, { username })).data,
    });
    const following = query.data?.following ?? false;
    const mutation = useMutation({
        mutationFn: async (next: boolean) => {
            if (!api) throw new Error('API not ready');
            return (
                await api.request(
                    'PUT /api/v1/authors/{username}/follow',
                    {
                        following: next,
                        idempotencyKey: crypto.randomUUID(),
                    },
                    undefined,
                    { username },
                )
            ).data;
        },
        onSuccess: (result) => {
            queryClient.setQueryData(key, result);
            void queryClient.invalidateQueries({ queryKey: ['profile-following'] });
        },
    });
    if (own.data?.username === username) return null;
    if (!session.isPending && !session.data)
        return (
            <Link
                className="button outline"
                href={`/auth?returnTo=${encodeURIComponent(`/authors/${encodeURIComponent(username)}`)}`}
            >
                Войти и подписаться
            </Link>
        );
    if (query.isError || own.isError || session.isError)
        return (
            <button
                className="button outline"
                onClick={() => {
                    void session.refetch();
                    void own.refetch();
                    void query.refetch();
                }}
            >
                Повторить загрузку подписки
            </button>
        );
    return (
        <>
            <button
                type="button"
                className={following ? 'button outline' : 'button primary'}
                disabled={!api || query.isPending || mutation.isPending}
                onClick={() => mutation.mutate(!following)}
            >
                {mutation.isPending ? 'Сохраняем…' : following ? 'Отписаться' : 'Подписаться'}
            </button>
            {mutation.isError && <small role="alert">Не удалось подписаться</small>}
        </>
    );
}
