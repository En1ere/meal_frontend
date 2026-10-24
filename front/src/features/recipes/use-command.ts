'use client';
import { useRef, useState } from 'react';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { contracts, type Route, type Success } from '../../shared/api/contracts.generated.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { readOfflineOwner } from '../offline/offline-store.js';
import { enqueueOfflineOperation } from '../offline/queue.js';
export function useRecipeCommand() {
    const { api, queryClient } = useRuntime();
    const signal = useRequestSignal();
    const [pending, setPending] = useState(false),
        [error, setError] = useState(''),
        [offlineQueued, setOfflineQueued] = useState(false);
    const queuedRef = useRef(false);
    const attempt = useRef<{
        route: Route;
        body: Record<string, unknown>;
        params: Record<string, string> | undefined;
    } | null>(null);
    async function run<R extends Route>(
        route: R,
        body: Record<string, unknown>,
        params?: Record<string, string>,
    ): Promise<Success<R>['data'] | undefined> {
        if (!api || pending) return;
        attempt.current ??= { route, body: { ...structuredClone(body), idempotencyKey: crypto.randomUUID() }, params };
        const parsed = contracts[attempt.current.route].request?.safeParse(attempt.current.body);
        if (parsed && !parsed.success) {
            setError(
                'Проверьте заполнение полей: ' +
                    parsed.error.issues.map((issue) => issue.path.join('.') + ': ' + issue.message).join('; '),
            );
            attempt.current = null;
            return;
        }
        if (attempt.current.route !== route) {
            setError('Сначала повторите предыдущую операцию с неизвестным результатом.');
            return;
        }
        const operation = attempt.current;
        setPending(true);
        setError('');
        setOfflineQueued(false);
        queuedRef.current = false;
        if (!navigator.onLine) {
            if (route !== 'POST /api/v1/cooking-attempts/{id}/progress' || !operationId(operation.params)) {
                setError('Это действие требует подключения к сети.');
                attempt.current = null;
                setPending(false);
                return;
            }
            const owner = readOfflineOwner();
            if (!owner) {
                setError('Подключитесь к сети и подтвердите аккаунт перед сохранением на устройстве.');
                attempt.current = null;
                setPending(false);
                return;
            }
            try {
                await enqueueOfflineOperation({
                    owner,
                    route,
                    body: operation.body,
                    params: operation.params,
                    operationType: 'update',
                    entityType: 'cooking',
                    entityId: operation.params.id!,
                    baseVersion: typeof operation.body.version === 'number' ? operation.body.version : null,
                });
                attempt.current = null;
                setOfflineQueued(true);
                queuedRef.current = true;
            } catch (reason) {
                setError(reason instanceof Error ? reason.message : 'Не удалось сохранить действие на устройстве.');
            } finally {
                setPending(false);
            }
            return;
        }
        const abort = signal();
        try {
            const v = attempt.current;
            const result = await api.request(route, v.body, abort, v.params);
            if (abort.aborted) return;
            attempt.current = null;
            return result.data;
        } catch (e) {
            if (abort.aborted) return;
            setError(
                e instanceof ApiError
                    ? e.message
                    : 'Ответ не получен. Повторите эту же операцию; данные для повтора сохранены.',
            );
            if (e instanceof ApiError && e.status < 500) {
                attempt.current = null;
                if (e.status === 401) {
                    api.invalidate();
                    queryClient.setQueryData(['session', 'user'], null);
                    queryClient.removeQueries({
                        predicate: (q) =>
                            ['recipe-workspace', 'cooking', 'shopping', 'recipe-community'].includes(
                                String(q.queryKey[0]),
                            ),
                    });
                }
            }
        } finally {
            if (!abort.aborted) setPending(false);
        }
    }
    return { run, pending, error, unknown: !!attempt.current, offlineQueued, wasQueued: () => queuedRef.current };
}

function operationId(params: Record<string, string> | undefined): params is Record<'id', string> {
    return typeof params?.id === 'string';
}
