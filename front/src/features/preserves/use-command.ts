'use client';
import { useRef, useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { contracts, type Route, type Success } from '../../shared/api/contracts.generated.js';
import { setUserSession } from '../../entities/session/client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
export function usePreserveCommand(scope: 'private' | 'family' = 'private') {
    const runtime = useRuntime();
    const { api, queryClient } = runtime;
    const signal = useRequestSignal();
    const [pending, setPending] = useState(false),
        [error, setError] = useState(''),
        [conflict, setConflict] = useState(false);
    const frozen = useRef<{ route: Route; body: Record<string, unknown>; params?: Record<string, string> } | null>(
        null,
    );
    const pendingRef = useRef(false);
    async function run<R extends Route>(
        route: R,
        body: Record<string, unknown>,
        params?: Record<string, string>,
    ): Promise<Success<R>['data'] | undefined> {
        if (!api || pendingRef.current) return;
        pendingRef.current = true;
        frozen.current ??= {
            route,
            body: { ...structuredClone(body), scope, idempotencyKey: crypto.randomUUID() },
            ...(params ? { params } : {}),
        };
        const operation = frozen.current;
        if (operation.route !== route) {
            setError('Сначала повторите предыдущую операцию с неизвестным результатом.');
            pendingRef.current = false;
            return;
        }
        const parsed = contracts[route].request?.safeParse(operation.body);
        if (parsed && !parsed.success) {
            setError(
                'Проверьте поля: ' + parsed.error.issues.map((v) => `${v.path.join('.')}: ${v.message}`).join('; '),
            );
            frozen.current = null;
            pendingRef.current = false;
            return;
        }
        setPending(true);
        setError('');
        setConflict(false);
        const abort = signal();
        try {
            const response = await api.request(route, operation.body, abort, operation.params);
            if (abort.aborted) return;
            frozen.current = null;
            await Promise.all(
                ['preserves', 'cooking', 'inventory', 'inventory-history', 'recipe-workspace'].map((key) =>
                    queryClient.invalidateQueries({ queryKey: [key] }),
                ),
            );
            return response.data;
        } catch (e) {
            if (abort.aborted) return;
            setConflict(e instanceof ApiError && e.status === 412);
            setError(
                e instanceof ApiError && e.status === 412
                    ? 'Данные изменились. Ваш ввод сохранён. Перечитайте карточку и проверьте изменения.'
                    : e instanceof ApiError
                      ? e.message
                      : 'Результат неизвестен. Повторите действие: сохранены прежний запрос и ключ.',
            );
            if (e instanceof ApiError && e.status < 500) {
                frozen.current = null;
                if (e.status === 401) {
                    api.invalidate();
                    setUserSession(runtime, null);
                    queryClient.removeQueries({ queryKey: ['preserves'] });
                }
            }
        } finally {
            pendingRef.current = false;
            if (!abort.aborted) setPending(false);
        }
    }
    return { run, pending, error, conflict, unknown: !!frozen.current };
}
