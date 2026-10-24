'use client';
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import { ApiError } from '../../shared/api/client.js';
import { contracts } from '../../shared/api/contracts.generated.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { RecipeShell, RecipeLoading, RecipeError, categoryLabels, methodLabels, recipeUnits } from './shared.js';
import {
    emptyDocument,
    moveRow,
    submissionProblems,
    recipeStatus,
    type WorkspaceRecipe,
    type RecipeDocument,
} from './workspace-state.js';
import styles from './workspace.module.css';
import { readOfflineOwner, subscribeOfflineState } from '../offline/offline-store.js';
import { enqueueOfflineOperation, readOfflineDraftState } from '../offline/queue.js';
import { readOfflineSnapshotData, saveOfflineSnapshot } from '../offline/snapshots.js';

function EditorForm({
    initial,
    initialDocument,
    draftId,
    scope,
}: {
    initial?: WorkspaceRecipe;
    initialDocument?: RecipeDocument;
    draftId: string;
    scope: 'private' | 'family';
}) {
    const { api, queryClient } = useRuntime();
    const router = useRouter();
    const user = useSession('user');
    const signal = useRequestSignal();
    const [recipe, setRecipe] = useState(initial);
    const [document, setDocument] = useState<RecipeDocument>(
        () => initial?.document ?? initialDocument ?? emptyDocument(),
    );
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [pending, setPending] = useState(false);
    const [conflict, setConflict] = useState(false);
    const [serverComparison, setServerComparison] = useState<RecipeDocument | null>(null);
    const [search, setSearch] = useState('');
    const preview = useRef<HTMLDialogElement>(null);
    const [unknown, setUnknown] = useState(false);
    const [offlineQueued, setOfflineQueued] = useState(false);
    const attempt = useRef<{ key: string; document: RecipeDocument } | null>(null);
    const products = useQuery({
        queryKey: ['products', 'editor', user.data?.id, search],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/products', undefined, signal, undefined, {
                    query: { q: search, limit: '100' },
                })
            ).data,
    });
    const update = (value: Partial<RecipeDocument>) => setDocument((previous) => ({ ...previous, ...value }));
    const problems = submissionProblems(document);
    async function save() {
        if (!api || pending) return;
        attempt.current ??= { key: crypto.randomUUID(), document: structuredClone(document) };
        const validation = contracts['POST /api/v1/recipe-workspace'].request.safeParse({
            idempotencyKey: attempt.current.key,
            scope,
            document: attempt.current.document,
        });
        if (!validation.success) {
            setError(
                'Проверьте поля: ' +
                    validation.error.issues.map((issue) => issue.path.join('.') + ': ' + issue.message).join('; '),
            );
            attempt.current = null;
            setUnknown(false);
            return;
        }
        if (scope === 'private' && !navigator.onLine) {
            const owner = readOfflineOwner();
            if (!owner) {
                setError('Подключитесь к сети и подтвердите аккаунт перед сохранением на устройстве.');
                return;
            }
            try {
                const value = attempt.current;
                await enqueueOfflineOperation({
                    owner,
                    route: recipe ? 'PUT /api/v1/recipe-workspace/{id}' : 'POST /api/v1/recipe-workspace',
                    body: recipe
                        ? { document: value.document, expectedVersion: recipe.version, idempotencyKey: value.key }
                        : { document: value.document, idempotencyKey: value.key, scope },
                    ...(recipe ? { params: { id: recipe.id } } : {}),
                    operationType: recipe ? 'update' : 'create',
                    entityType: 'recipe',
                    entityId: recipe?.id ?? `draft:${draftId}`,
                    baseVersion: recipe?.version ?? null,
                });
                await saveOfflineSnapshot(
                    owner,
                    `recipe-workspace:${recipe?.id ?? `new:${draftId}`}`,
                    recipe ? { ...recipe, document: value.document } : value.document,
                );
                if (!recipe)
                    router.replace(`/recipes/new?offlineDraft=${encodeURIComponent(draftId)}`, { scroll: false });
                attempt.current = null;
                setOfflineQueued(true);
                setNotice('Черновик сохранён на устройстве и будет отправлен после появления сети.');
                setUnknown(false);
            } catch (reason) {
                setError(reason instanceof Error ? reason.message : 'Не удалось сохранить черновик на устройстве.');
            }
            return;
        }
        setPending(true);
        setError('');
        setNotice('');
        const abort = signal();
        try {
            const value = attempt.current;
            const result = recipe
                ? await api.request(
                      'PUT /api/v1/recipe-workspace/{id}',
                      { document: value.document, expectedVersion: recipe.version, idempotencyKey: value.key },
                      abort,
                      { id: recipe.id },
                  )
                : await api.request(
                      'POST /api/v1/recipe-workspace',
                      { document: value.document, idempotencyKey: value.key, scope },
                      abort,
                  );
            if (abort.aborted) return;
            attempt.current = null;
            setRecipe(result.data.recipe);
            setDocument(result.data.recipe.document);
            setConflict(false);
            setNotice('Черновик сохранён. Публикация выполняется отдельно.');
            await queryClient.invalidateQueries({ queryKey: ['recipe-workspace'] });
            if (!recipe)
                router.replace(
                    scope === 'family'
                        ? `/family/recipes/${result.data.recipe.id}/edit`
                        : `/recipes/${result.data.recipe.id}/edit`,
                );
        } catch (e) {
            if (abort.aborted) return;
            setError(e instanceof ApiError ? e.message : 'Ответ не получен. Повторите сохранение с теми же данными.');
            if (e instanceof ApiError && e.status < 500) {
                attempt.current = null;
                setConflict(e.status === 412);
            }
        } finally {
            setUnknown(!!attempt.current);
            if (!abort.aborted) setPending(false);
        }
    }
    async function reload() {
        if (!api || !recipe || pending) return;
        setPending(true);
        try {
            const result = await api.request(
                'GET /api/v1/recipe-workspace/{id}',
                undefined,
                signal(),
                { id: recipe.id },
                { query: { scope } },
            );
            setRecipe(result.data.recipe);
            setConflict(false);
            setServerComparison(result.data.recipe.document);
            setNotice(
                'Версия обновлена; ваши поля сохранены для сравнения. Перед сохранением проверьте актуальный рецепт в предпросмотре сервера.',
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось загрузить версию');
        } finally {
            setUnknown(!!attempt.current);
            setPending(false);
        }
    }
    return (
        <>
            <Link href={scope === 'family' ? '/family/recipes' : '/recipes/mine'}>
                ← {scope === 'family' ? 'Рецепты семьи' : 'Мои рецепты'}
            </Link>
            <div className={styles.actions}>
                <h1>{recipe ? 'Редактор рецепта' : 'Новый рецепт'}</h1>
                <span>
                    {scope === 'family' ? 'Семья' : 'Только я'} ·{' '}
                    {recipe ? (recipeStatus[recipe.status] ?? recipe.status) : 'Черновик'}
                </span>
            </div>
            <p>
                {scope === 'family'
                    ? 'Рецепт доступен семье, но авторство и право редактирования остаются за вами.'
                    : 'Сохраните личный черновик. Проверка и отправка на модерацию доступны отдельно.'}
            </p>
            {error && (
                <div role="alert" className={styles.notice}>
                    {error}
                    {conflict && (
                        <>
                            <p>Ваш ввод сохранён. Загрузите серверную версию и сравните изменения.</p>
                            <button onClick={() => void reload()}>Загрузить актуальную версию</button>
                        </>
                    )}
                </div>
            )}
            {notice && (
                <p role="status" className={styles.notice}>
                    {notice}
                </p>
            )}
            {unknown && !pending && (
                <p role="status">Неизвестен результат прошлого сохранения. До повтора поля заблокированы.</p>
            )}
            <fieldset
                disabled={pending || unknown || offlineQueued || !!recipe?.archived}
                style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
                <div className={styles.layout}>
                    <div className={styles.stack}>
                        <section className={styles.panel}>
                            <h2>1. Название и описание</h2>
                            <label>
                                Название
                                <input
                                    maxLength={300}
                                    value={document.title}
                                    onChange={(e) => update({ title: e.target.value })}
                                />
                            </label>
                            <label>
                                Краткое описание
                                <textarea
                                    rows={3}
                                    maxLength={10000}
                                    value={document.description ?? ''}
                                    onChange={(e) => update({ description: e.target.value || null })}
                                />
                            </label>
                            <p>Фото необязательно. Загрузка фото пока недоступна.</p>
                        </section>
                        <section className={styles.panel}>
                            <h2>2. Ингредиенты</h2>
                            <label>
                                Поиск продукта
                                <input value={search} onChange={(e) => setSearch(e.target.value)} />
                            </label>
                            {products.isError && (
                                <p role="alert">
                                    Не удалось загрузить каталог.{' '}
                                    <button onClick={() => void products.refetch()}>Повторить</button>
                                </p>
                            )}
                            <div className={styles.actions}>
                                {products.data?.items
                                    .filter((product) => scope === 'private' || product.status === 'approved')
                                    .slice(0, 10)
                                    .map((product) => (
                                        <button
                                            type="button"
                                            key={product.id}
                                            onClick={() =>
                                                update({
                                                    ingredients: [
                                                        ...document.ingredients,
                                                        {
                                                            ingredientId: product.id,
                                                            variantId: null,
                                                            productId: null,
                                                            sourceRecipeId: null,
                                                            quantity: null,
                                                            unit: product.defaultUnit,
                                                            optional: false,
                                                        },
                                                    ],
                                                })
                                            }
                                        >
                                            + {product.name}
                                        </button>
                                    ))}
                            </div>
                            {document.ingredients.map((item, index) => (
                                <div className={styles.row} key={index}>
                                    <label>
                                        Продукт
                                        <span>
                                            {products.data?.items.find((product) => product.id === item.ingredientId)
                                                ?.name ??
                                                `Ингредиент ${index + 1} (${item.ingredientId ?? item.variantId ?? item.productId ?? item.sourceRecipeId})`}
                                        </span>
                                    </label>
                                    <label>
                                        Количество
                                        <input
                                            inputMode="decimal"
                                            pattern="[0-9]+([.][0-9]{1,8})?"
                                            value={item.quantity ?? ''}
                                            placeholder="Неизвестно"
                                            onChange={(e) =>
                                                update({
                                                    ingredients: document.ingredients.map((row, i) =>
                                                        i === index
                                                            ? { ...row, quantity: e.target.value || null }
                                                            : row,
                                                    ),
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Единица
                                        <select
                                            value={item.unit ?? ''}
                                            onChange={(e) =>
                                                update({
                                                    ingredients: document.ingredients.map((row, i) =>
                                                        i === index ? { ...row, unit: e.target.value || null } : row,
                                                    ),
                                                })
                                            }
                                        >
                                            <option value="">Не указана</option>
                                            {Object.entries(recipeUnits).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className={`${styles.actions} ${styles.full}`}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={item.optional}
                                                onChange={(e) =>
                                                    update({
                                                        ingredients: document.ingredients.map((row, i) =>
                                                            i === index ? { ...row, optional: e.target.checked } : row,
                                                        ),
                                                    })
                                                }
                                            />{' '}
                                            По желанию
                                        </label>
                                        <button
                                            disabled={index === 0}
                                            onClick={() =>
                                                update({ ingredients: moveRow(document.ingredients, index, -1) })
                                            }
                                            aria-label={`Ингредиент ${index + 1} вверх`}
                                        >
                                            ↑
                                        </button>
                                        <button
                                            disabled={index === document.ingredients.length - 1}
                                            onClick={() =>
                                                update({ ingredients: moveRow(document.ingredients, index, 1) })
                                            }
                                            aria-label={`Ингредиент ${index + 1} вниз`}
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() =>
                                                update({
                                                    ingredients: document.ingredients.filter((_, i) => i !== index),
                                                })
                                            }
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {!document.ingredients.length && (
                                <p>Ингредиенты ещё не добавлены. Неполный черновик можно сохранить.</p>
                            )}
                        </section>
                        <section className={styles.panel}>
                            <h2>3. Шаги приготовления</h2>
                            {document.steps.map((step, index) => (
                                <div key={index} className={styles.panel}>
                                    <label>
                                        Шаг {index + 1}
                                        <textarea
                                            rows={3}
                                            value={step.text}
                                            onChange={(e) =>
                                                update({
                                                    steps: document.steps.map((row, i) =>
                                                        i === index ? { ...row, text: e.target.value } : row,
                                                    ),
                                                })
                                            }
                                        />
                                    </label>
                                    <div className={styles.row}>
                                        <label>
                                            Таймер, секунд
                                            <input
                                                type="number"
                                                min={0}
                                                max={604800}
                                                value={step.durationSeconds ?? ''}
                                                onChange={(e) =>
                                                    update({
                                                        steps: document.steps.map((row, i) =>
                                                            i === index
                                                                ? {
                                                                      ...row,
                                                                      durationSeconds:
                                                                          e.target.value === ''
                                                                              ? null
                                                                              : Number(e.target.value),
                                                                  }
                                                                : row,
                                                        ),
                                                    })
                                                }
                                            />
                                        </label>
                                        <label>
                                            Температура, °C
                                            <input
                                                inputMode="decimal"
                                                value={step.temperature ?? ''}
                                                onChange={(e) =>
                                                    update({
                                                        steps: document.steps.map((row, i) =>
                                                            i === index
                                                                ? { ...row, temperature: e.target.value || null }
                                                                : row,
                                                        ),
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>
                                    <div className={styles.actions}>
                                        <button
                                            disabled={index === 0}
                                            onClick={() => update({ steps: moveRow(document.steps, index, -1) })}
                                        >
                                            ↑ Вверх
                                        </button>
                                        <button
                                            disabled={index === document.steps.length - 1}
                                            onClick={() => update({ steps: moveRow(document.steps, index, 1) })}
                                        >
                                            ↓ Вниз
                                        </button>
                                        <button
                                            onClick={() =>
                                                update({ steps: document.steps.filter((_, i) => i !== index) })
                                            }
                                        >
                                            Удалить шаг
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() =>
                                    update({
                                        steps: [
                                            ...document.steps,
                                            { text: '', durationSeconds: null, temperature: null },
                                        ],
                                    })
                                }
                            >
                                + Добавить шаг
                            </button>
                        </section>
                    </div>
                    <aside className={styles.stack}>
                        <section className={styles.panel}>
                            <h2>4. Дополнительная информация</h2>
                            <label>
                                Категория
                                <select
                                    value={document.category ?? ''}
                                    onChange={(e) => update({ category: e.target.value || null })}
                                >
                                    <option value="">Не выбрана</option>
                                    {Object.entries(categoryLabels).map(([v, l]) => (
                                        <option key={v} value={v}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Порции
                                <input
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={document.baseServings}
                                    onChange={(e) => update({ baseServings: Number(e.target.value) })}
                                />
                            </label>
                            <label>
                                Способ приготовления
                                <select value={document.method} onChange={(e) => update({ method: e.target.value })}>
                                    <option value="">Не указан</option>
                                    {Object.entries(methodLabels).map(([v, l]) => (
                                        <option key={v} value={v}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Метки через запятую
                                <input
                                    value={document.tags.join(', ')}
                                    onChange={(e) =>
                                        update({
                                            tags: e.target.value
                                                .split(',')
                                                .map((v) => v.trim())
                                                .filter(Boolean),
                                        })
                                    }
                                />
                            </label>
                        </section>
                        <section className={styles.panel}>
                            <h2>Предпросмотр</h2>
                            <h3>{document.title || 'Без названия'}</h3>
                            <p>{document.description || 'Описание не добавлено'}</p>
                            <p>
                                {document.baseServings} порций · {document.ingredients.length} ингредиентов ·{' '}
                                {document.steps.length} шагов
                            </p>
                            <p>Нет оценок.</p>
                            {recipe?.nutrition.status === 'base-unadjusted' && (
                                <p role="status">
                                    Данные базового рецепта — изменения не учтены. Непокрытые ингредиенты:{' '}
                                    {recipe.nutrition.uncoveredIngredientIds.join(', ') || 'Нет полных данных'}.
                                </p>
                            )}
                            {recipe?.nutrition.base ? (
                                <p>
                                    КБЖУ сохранённой редакции: {recipe.nutrition.base.kcal ?? '—'} ккал · Б{' '}
                                    {recipe.nutrition.base.protein ?? '—'} · Ж {recipe.nutrition.base.fat ?? '—'} · У{' '}
                                    {recipe.nutrition.base.carbs ?? '—'}. Основа:{' '}
                                    {recipe.nutrition.base.basis === 'recipe' ? 'весь рецепт' : 'порция'}. Несохранённые
                                    изменения ещё не пересчитаны.
                                </p>
                            ) : (
                                <p>Полных данных для КБЖУ нет.</p>
                            )}
                            <h3>Готовность к публикации</h3>
                            {problems.length ? (
                                <ul>
                                    {problems.map((problem) => (
                                        <li key={problem}>{problem}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p>Обязательные поля заполнены.</p>
                            )}
                        </section>
                    </aside>
                </div>
            </fieldset>
            <div className={styles.actions}>
                <button
                    className="button"
                    disabled={pending || conflict || offlineQueued || !!recipe?.archived}
                    onClick={() => void save()}
                >
                    {pending
                        ? 'Сохраняем…'
                        : offlineQueued
                          ? 'Сохранено на устройстве'
                          : unknown
                            ? 'Повторить сохранение'
                            : 'Сохранить черновик'}
                </button>
                <button className="button outline" onClick={() => preview.current?.showModal()}>
                    Предпросмотр
                </button>
                {recipe && (
                    <Link href={`${scope === 'family' ? '/family/recipes' : '/recipes/mine'}?selected=${recipe.id}`}>
                        Управление публикацией
                    </Link>
                )}
                {scope === 'private' && recipe && !recipe.archived && (
                    <Link href={`/recipes/${recipe.id}/cook`}>Приготовить личный рецепт</Link>
                )}
            </div>
            <dialog ref={preview} className={styles.dialog} aria-label="Предпросмотр рецепта">
                <h2>{document.title || 'Без названия'}</h2>
                <p>{document.description}</p>
                <p>
                    {scope === 'family' ? 'Семья' : 'Только я'} · {document.baseServings} порций
                </p>
                <ol>
                    {document.steps.map((step, i) => (
                        <li key={i}>{step.text || 'Шаг не заполнен'}</li>
                    ))}
                </ol>
                {serverComparison && (
                    <>
                        <h3>Актуальная серверная версия</h3>
                        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(serverComparison, null, 2)}</pre>
                    </>
                )}
                <button onClick={() => preview.current?.close()}>Закрыть</button>
            </dialog>
        </>
    );
}
function EditorContent({ id, scope }: { id?: string; scope: 'private' | 'family' }) {
    const { api } = useRuntime();
    const router = useRouter();
    const user = useSession('user');
    const search = useSearchParams();
    const [generatedDraftId] = useState(() => crypto.randomUUID());
    const requestedDraftId = search.get('offlineDraft');
    const draftId =
        requestedDraftId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(requestedDraftId)
            ? requestedDraftId
            : generatedDraftId;
    const owner = user.data?.id ?? readOfflineOwner();
    const browserOnline = useSyncExternalStore(
        subscribeOfflineState,
        () => navigator.onLine,
        () => true,
    );
    const online = scope === 'family' ? true : browserOnline;
    const query = useQuery({
        queryKey: ['recipe-workspace', owner, scope, id],
        enabled: !!api && !!owner && !!id,
        queryFn: async ({ signal }) => {
            if (scope === 'private' && !navigator.onLine) {
                const cached = await readOfflineSnapshotData<WorkspaceRecipe>(owner!, `recipe-workspace:${id}`);
                if (!cached) throw new Error('Этот рецепт не сохранён для offline-редактирования.');
                return cached;
            }
            const recipe = (
                await api!.request(
                    'GET /api/v1/recipe-workspace/{id}',
                    undefined,
                    signal,
                    { id: id! },
                    {
                        query: { scope },
                    },
                )
            ).data.recipe;
            if (scope === 'private') await saveOfflineSnapshot(owner!, `recipe-workspace:${id}`, recipe);
            return recipe;
        },
    });
    const localDraft = useQuery({
        queryKey: ['recipe-workspace', owner, 'new', draftId, 'offline'],
        enabled: scope === 'private' && !!owner && !id && !online,
        queryFn: () => readOfflineSnapshotData<RecipeDocument>(owner!, `recipe-workspace:new:${draftId}`),
    });
    const draftState = useQuery({
        queryKey: ['offline-draft-state', owner, draftId],
        enabled: scope === 'private' && !!owner && !id && online && !!requestedDraftId,
        queryFn: () => readOfflineDraftState(owner!, `draft:${draftId}`),
        refetchInterval: (query) => (query.state.data?.unresolvedStatus ? 2_000 : false),
    });
    useEffect(() => {
        if (draftState.data?.serverId) router.replace(`/recipes/${draftState.data.serverId}/edit`);
    }, [draftState.data?.serverId, router]);
    if (!id) {
        if ((!online && localDraft.isPending) || (online && !!requestedDraftId && draftState.isPending))
            return <RecipeLoading />;
        if (online && requestedDraftId && draftState.isError)
            return (
                <section className="status-panel" role="alert">
                    <h1>Не удалось проверить offline-черновик</h1>
                    <p>Создание нового рецепта заблокировано, чтобы не отправить сохранённый черновик повторно.</p>
                    <button onClick={() => void draftState.refetch()}>Повторить проверку</button>
                </section>
            );
        if (draftState.data?.serverId) return <RecipeLoading />;
        if (online && draftState.data?.unresolvedStatus)
            return (
                <section className="status-panel" role="status">
                    <h1>Завершаем создание рецепта</h1>
                    <p>Исходный offline-черновик уже находится в очереди. Новый рецепт не будет создан повторно.</p>
                    {draftState.data.unresolvedError && <p>{draftState.data.unresolvedError}</p>}
                    {['conflict', 'rejected'].includes(draftState.data.unresolvedStatus) && (
                        <Link href="/settings/offline">Открыть очередь и проверить сохранённые данные</Link>
                    )}
                </section>
            );
        return (
            <EditorForm
                draftId={draftId}
                scope={scope}
                {...(localDraft.data ? { initialDocument: localDraft.data } : {})}
            />
        );
    }
    if (query.isPending) return <RecipeLoading />;
    if (query.isError) return <RecipeError error={query.error} retry={() => void query.refetch()} />;
    if (!query.data.canEdit)
        return (
            <section className="status-panel" role="alert">
                <h1>Редактирование недоступно</h1>
                <p>Семейный рецепт может изменять только его автор.</p>
                <Link href={`/family/recipes/${id}`}>Открыть рецепт</Link>
            </section>
        );
    return <EditorForm key={id} draftId={draftId} scope={scope} initial={query.data} />;
}
export function RecipeEditor({ id, scope = 'private' }: { id?: string; scope?: 'private' | 'family' }) {
    return (
        <Guard context="user" allowOffline={scope === 'private'}>
            <RecipeShell family={scope === 'family'}>
                <Suspense fallback={<RecipeLoading />}>
                    <EditorContent scope={scope} {...(id ? { id } : {})} />
                </Suspense>
            </RecipeShell>
        </Guard>
    );
}
