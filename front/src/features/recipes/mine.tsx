'use client';
import Link from 'next/link';
import { useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { RecipeShell, RecipeLoading, RecipeError } from './shared.js';
import {
    canSubmitCurrentRevision,
    publicationState,
    recipeStatus,
    submissionProblems,
    type WorkspaceRecipe,
} from './workspace-state.js';
import styles from './workspace.module.css';
import { readOfflineOwner, subscribeOfflineState } from '../../entities/offline/store.js';
import { enqueueOfflineOperation } from '../../entities/offline/queue.js';
import { isConsentRequiredError, useConsent } from '../../entities/consent/client.js';
import { readOfflineSnapshotData, saveOfflineSnapshot } from '../../entities/offline/snapshots.js';
import { normalizeCachedWorkspaceList } from '../../entities/recipe/index.js';
type Command = 'archive' | 'restore' | 'submit' | 'rollback';
type WorkspaceScope = 'private' | 'family';
function MineContent({ scope }: { scope: WorkspaceScope }) {
    const { api, queryClient } = useRuntime();
    const user = useSession('user');
    const publicationConsent = useConsent('dissemination');
    const owner = user.data?.id ?? readOfflineOwner();
    const browserOnline = useSyncExternalStore(
        subscribeOfflineState,
        () => navigator.onLine,
        () => true,
    );
    const online = scope === 'family' ? true : browserOnline;
    const basePath = scope === 'family' ? '/family/recipes' : '/recipes/mine';
    const search = useSearchParams();
    const q = search.get('q') ?? '',
        status = search.get('status') === 'archived' ? 'archived' : 'active',
        page = Math.max(1, Number(search.get('page')) || 1);
    const [pending, setPending] = useState(false),
        [error, setError] = useState(''),
        [notice, setNotice] = useState('');
    const [unknown, setUnknown] = useState(false);
    const attempt = useRef<{ id: string; command: Command; version: number; key: string } | null>(null);
    const pendingRef = useRef(false);
    const query = useQuery({
        queryKey: ['recipe-workspace', owner, scope, q, status, page],
        enabled: !!api && !!owner,
        queryFn: async ({ signal }) => {
            const snapshotKey = `recipe-workspace:list:${status}:${page}:${q}`;
            if (scope === 'private' && !navigator.onLine) {
                const cached = await readOfflineSnapshotData<Success<'GET /api/v1/recipe-workspace'>['data']>(
                    owner!,
                    snapshotKey,
                );
                if (!cached) throw new Error('Этот список рецептов ещё не сохранён для работы без сети.');
                return normalizeCachedWorkspaceList(cached);
            }
            const data = (
                await api!.request('GET /api/v1/recipe-workspace', undefined, signal, undefined, {
                    query: { q, scope, status, page: String(page), limit: '20' },
                })
            ).data;
            if (scope === 'private') await saveOfflineSnapshot(owner!, snapshotKey, data);
            return data;
        },
    });
    const href = (values: Record<string, string>) => {
        const p = new URLSearchParams(search);
        for (const [k, v] of Object.entries(values)) p.set(k, v);
        return `${basePath}?${p}`;
    };
    async function command(recipe: WorkspaceRecipe, kind: Command) {
        if (!api || pendingRef.current) return;
        pendingRef.current = true;
        attempt.current ??= { id: recipe.id, command: kind, version: recipe.version, key: crypto.randomUUID() };
        const value = attempt.current;
        setPending(true);
        setError('');
        setNotice('');
        if (scope === 'private' && !navigator.onLine) {
            if (!['archive', 'restore'].includes(kind)) {
                setError('Отправка на модерацию и откат требуют подключения к сети.');
                setPending(false);
                attempt.current = null;
                pendingRef.current = false;
                return;
            }
            const owner = readOfflineOwner();
            if (!owner) {
                setError('Подключитесь к сети и подтвердите аккаунт перед сохранением на устройстве.');
                setPending(false);
                attempt.current = null;
                pendingRef.current = false;
                return;
            }
            try {
                await enqueueOfflineOperation({
                    owner,
                    route:
                        kind === 'archive'
                            ? 'POST /api/v1/recipe-workspace/{id}/archive'
                            : 'POST /api/v1/recipe-workspace/{id}/restore',
                    body: { idempotencyKey: value.key, expectedVersion: value.version },
                    params: { id: value.id },
                    operationType: kind === 'archive' ? 'archive' : 'restore',
                    entityType: 'recipe',
                    entityId: value.id,
                    baseVersion: value.version,
                });
                attempt.current = null;
                setNotice('Действие сохранено на устройстве и будет отправлено после появления сети.');
            } catch (reason) {
                setError(reason instanceof Error ? reason.message : 'Не удалось сохранить действие на устройстве.');
            } finally {
                setUnknown(!!attempt.current);
                setPending(false);
                pendingRef.current = false;
            }
            return;
        }
        try {
            await api.request(
                `POST /api/v1/recipe-workspace/{id}/${value.command}`,
                { idempotencyKey: value.key, expectedVersion: value.version },
                undefined,
                { id: value.id },
            );
            attempt.current = null;
            setNotice(
                kind === 'submit'
                    ? 'Редакция отправлена на ручную модерацию. Она ещё не опубликована.'
                    : 'Изменения сохранены.',
            );
            await queryClient.invalidateQueries({ queryKey: ['recipe-workspace'] });
        } catch (e) {
            const submitConflict = value.command === 'submit' && e instanceof ApiError && [409, 412].includes(e.status);
            if (submitConflict) {
                await queryClient.invalidateQueries({ queryKey: ['recipe-workspace'], refetchType: 'none' });
                const refreshed = await query.refetch();
                attempt.current = null;
                setError(
                    refreshed.error
                        ? `${e.message}. Перечитать список не удалось; повторите загрузку перед новой отправкой.`
                        : `${e.message}. Список рецептов перечитан; проверьте актуальную редакцию перед новой отправкой.`,
                );
            } else {
                setError(
                    isConsentRequiredError(e)
                        ? 'Отправка на публикацию заблокирована: требуется отдельное согласие.'
                        : e instanceof ApiError
                          ? e.message
                          : 'Ответ не получен. Повторите ту же команду.',
                );
                if (e instanceof ApiError && e.status < 500) attempt.current = null;
            }
        } finally {
            setUnknown(!!attempt.current);
            setPending(false);
            pendingRef.current = false;
        }
    }
    return (
        <>
            <Link href={scope === 'family' ? '/family' : '/recipes'}>← {scope === 'family' ? 'Семья' : 'Каталог'}</Link>
            <div className={styles.actions}>
                <h1>{scope === 'family' ? 'Рецепты семьи' : 'Мои рецепты'}</h1>
                <Link className="button" href={scope === 'family' ? '/family/recipes/new' : '/recipes/new'}>
                    Создать рецепт
                </Link>
            </div>
            <p>
                {scope === 'family'
                    ? 'Общие рецепты семьи. Авторство сохраняется за создавшим рецепт пользователем.'
                    : 'Личные черновики, варианты и публикации. Архивирование сохраняет историю.'}
            </p>
            {!publicationConsent.enabled && (
                <section className={styles.panel} role="status">
                    <strong>Новые публикации заблокированы</strong>
                    <p>Черновики, редактирование, архивирование и удаление остаются доступны.</p>
                    <Link
                        href={`${'/settings/privacy?consent=dissemination&returnTo='}${encodeURIComponent(basePath)}`}
                    >
                        Ознакомиться и согласиться
                    </Link>
                </section>
            )}
            <form action={basePath} className={styles.actions}>
                <input name="q" defaultValue={q} aria-label="Поиск моих рецептов" />
                <input type="hidden" name="status" value={status} />
                <button>Найти</button>
            </form>
            <nav className={styles.actions} aria-label="Статус рецептов">
                <Link
                    href={href({ status: 'active', page: '1' })}
                    aria-current={status === 'active' ? 'page' : undefined}
                >
                    Активные
                </Link>
                <Link
                    href={href({ status: 'archived', page: '1' })}
                    aria-current={status === 'archived' ? 'page' : undefined}
                >
                    Архив
                </Link>
            </nav>
            {error && <p role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            {unknown && (
                <button
                    disabled={pending}
                    onClick={() => {
                        const a = attempt.current;
                        if (a) {
                            const r = query.data?.items.find((r) => r.id === a.id);
                            if (r) void command(r, a.command);
                        }
                    }}
                >
                    {pending ? 'Повторяем незавершённую команду…' : 'Повторить незавершённую команду'}
                </button>
            )}
            {query.isPending ? (
                <RecipeLoading />
            ) : query.isError ? (
                <RecipeError error={query.error} retry={() => void query.refetch()} />
            ) : (
                <div className={styles.stack}>
                    {!online && <p role="status">Показана сохранённая копия. Действия попадут в очередь.</p>}
                    {!query.data.items.length && (
                        <p>Рецептов пока нет. Начните с {scope === 'family' ? 'семейного' : 'личного'} черновика.</p>
                    )}
                    {query.data.items.map((recipe) => {
                        const publication = publicationState(recipe);
                        const currentReview = recipe.review.revisionId === recipe.revisionId;
                        return (
                            <article key={recipe.id} className={styles.panel}>
                                <div className={styles.actions}>
                                    <h2>
                                        <Link
                                            href={
                                                scope === 'family'
                                                    ? recipe.canEdit
                                                        ? `/family/recipes/${recipe.id}/edit`
                                                        : `/family/recipes/${recipe.id}`
                                                    : `/recipes/${recipe.id}/edit`
                                            }
                                        >
                                            {recipe.document.title || 'Без названия'}
                                        </Link>
                                    </h2>
                                    <span>
                                        {recipeStatus[recipe.review.status] ?? recipe.review.status}
                                        {recipe.baseRecipeId ? ' · Вариант' : ''}
                                    </span>
                                </div>
                                <p>{recipe.document.description || 'Описание не добавлено'}</p>
                                {scope === 'family' && <p>Автор: @{recipe.authorLogin ?? 'профиль недоступен'}</p>}
                                <p>
                                    {recipe.document.ingredients.length} ингредиентов · {recipe.document.steps.length}{' '}
                                    шагов · Редакция {recipe.revision}
                                </p>
                                <p role={publication.mismatch ? 'status' : undefined}>{publication.label}</p>
                                {!currentReview && (
                                    <p role="status">
                                        Статус модерации относится к ранее отправленной редакции; текущая редакция в
                                        редакторе остаётся отдельной.
                                    </p>
                                )}
                                {recipe.review.publicReason && (
                                    <p role="alert">Причина модерации: {recipe.review.publicReason}</p>
                                )}
                                {currentReview && recipe.review.status !== 'draft' && (
                                    <p>Чтобы отправить рецепт повторно, сначала создайте новую редакцию.</p>
                                )}
                                <div className={styles.actions}>
                                    {recipe.canEdit ? (
                                        <Link
                                            href={
                                                scope === 'family'
                                                    ? `/family/recipes/${recipe.id}/edit`
                                                    : `/recipes/${recipe.id}/edit`
                                            }
                                        >
                                            Открыть редактор
                                        </Link>
                                    ) : (
                                        <Link href={`/family/recipes/${recipe.id}`}>Открыть рецепт</Link>
                                    )}
                                    {publication.publicHref && (
                                        <Link href={publication.publicHref}>Публичная карточка</Link>
                                    )}
                                    {recipe.canEdit && (
                                        <button
                                            disabled={pending || unknown}
                                            onClick={() =>
                                                void command(recipe, recipe.archived ? 'restore' : 'archive')
                                            }
                                        >
                                            {recipe.archived ? 'Восстановить' : 'Архивировать'}
                                        </button>
                                    )}
                                    {recipe.canEdit && !recipe.archived && (
                                        <>
                                            <button
                                                disabled={
                                                    pending ||
                                                    unknown ||
                                                    !publicationConsent.enabled ||
                                                    submissionProblems(recipe.document).length > 0 ||
                                                    !canSubmitCurrentRevision(recipe)
                                                }
                                                onClick={() => void command(recipe, 'submit')}
                                            >
                                                Отправить на модерацию
                                            </button>
                                            <button
                                                disabled={pending || unknown || recipe.revision < 2}
                                                onClick={() => void command(recipe, 'rollback')}
                                            >
                                                Откатить предыдущую редакцию
                                            </button>
                                        </>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                    <nav className={styles.actions} aria-label="Страницы">
                        {page > 1 && <Link href={href({ page: String(page - 1) })}>Назад</Link>}
                        <span>Страница {page}</span>
                        {page * 20 < query.data.total && <Link href={href({ page: String(page + 1) })}>Далее</Link>}
                    </nav>
                </div>
            )}
        </>
    );
}
export function MyRecipes({ scope = 'private' }: { scope?: WorkspaceScope }) {
    return (
        <RecipeShell family={scope === 'family'}>
            <MineContent scope={scope} />
        </RecipeShell>
    );
}
