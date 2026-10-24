import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { AdminShell } from '../admin/admin-shell.js';
import { Guard } from '../auth/session.js';
import styles from './allergens.module.css';

type Detail = Success<'GET /api/v1/admin/allergens/{code}'>['data'];
type Mapping = Detail['mappings'][number];
const statusLabels = { contains: 'Содержит', may_contain: 'Может содержать', unknown: 'Нет данных' } as const;
const subjectLabels = { ingredient: 'Ингредиент', variant: 'Вариант', product: 'Продукт' } as const;
const productImages = [
    '/assets/products/milk.png',
    '/assets/products/cheese.png',
    '/assets/products/tomato.png',
    '/assets/products/cucumber.png',
];
const subjectImage = (mapping: Mapping) => {
    const name = mapping.subjectName.toLocaleLowerCase('ru');
    if (name.includes('молок')) return productImages[0]!;
    if (name.includes('сыр') || name.includes('майонез')) return productImages[1]!;
    if (name.includes('томат')) return productImages[2]!;
    if (name.includes('огур')) return productImages[3]!;
    if (name.includes('рыб') || name.includes('лосос')) return '/assets/allergens/fish.png';
    if (name.includes('кревет') || name.includes('морск')) return '/assets/allergens/shellfish.png';
    if (name.includes('миндал') || name.includes('орех')) return '/assets/allergens/tree-nuts.png';
    if (name.includes('арахис')) return '/assets/allergens/peanut.png';
    if (name.includes('пшен') || name.includes('паст')) return '/assets/allergens/gluten.png';
    if (name.includes('сое') || name.includes('тофу')) return '/assets/allergens/soy.png';
    return '/assets/allergens/unknown.png';
};
const iconUrl = (icon: Detail['icon']) => {
    if (icon.url) return icon.url;
    const key = icon.fallbackKey.replace(/^allergen-/, '').replace('_', '-');
    const known = new Set(['milk', 'egg', 'fish', 'shellfish', 'tree-nuts', 'peanut', 'gluten', 'soy']);
    return `/assets/allergens/${known.has(key) ? key : 'unknown'}.png`;
};
const message = (error: unknown) =>
    error instanceof ApiError ? error.message : 'Операция не выполнена. Попробуйте ещё раз.';

export function AllergensPage() {
    const { api, queryClient } = useRuntime();
    const { code } = useParams();
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'mapped' | 'empty'>('all');
    const [pending, setPending] = useState('');
    const [error, setError] = useState('');
    const [subjectType, setSubjectType] = useState<Mapping['subjectType']>('ingredient');
    const [subjectSearch, setSubjectSearch] = useState('');
    const [subjectQuery, setSubjectQuery] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [stagedIcon, setStagedIcon] = useState<{ code: string; file: File; dataUrl: string } | null>(null);
    const list = useQuery({
        queryKey: ['admin', 'allergens'],
        enabled: !!api,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/admin/allergens', undefined, signal)).data,
    });
    const visible = useMemo(
        () =>
            (list.data?.items ?? []).filter((item) => {
                const matchesQuery = `${item.name} ${item.code}`
                    .toLocaleLowerCase('ru')
                    .includes(query.toLocaleLowerCase('ru'));
                return (
                    matchesQuery &&
                    (filter === 'all' || (filter === 'mapped' ? item.activeMappings > 0 : item.activeMappings === 0))
                );
            }),
        [filter, list.data, query],
    );
    const selectedCode = code ?? visible[0]?.code;
    const detail = useQuery({
        queryKey: ['admin', 'allergens', 'detail', selectedCode],
        enabled: !!api && !!selectedCode,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/admin/allergens/{code}', undefined, signal, { code: selectedCode! })).data,
    });
    const subjects = useQuery({
        queryKey: ['admin', 'allergen-subjects', subjectType, subjectQuery],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/admin/allergens/subjects', undefined, signal, undefined, {
                    query: { subjectType, q: subjectQuery, limit: '50' },
                })
            ).data,
    });
    async function mutate(label: string, run: (current: Detail) => Promise<Detail>) {
        if (!detail.data || pending) return false;
        setPending(label);
        setError('');
        try {
            const next = await run(detail.data);
            queryClient.setQueryData(['admin', 'allergens', 'detail', detail.data.code], next);
            await queryClient.invalidateQueries({ queryKey: ['admin', 'allergens'], exact: false });
            return true;
        } catch (cause) {
            setError(message(cause));
            return false;
        } finally {
            setPending('');
        }
    }
    async function add(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const field = (name: string) => {
            const value = values.get(name);
            return typeof value === 'string' ? value : '';
        };
        await mutate(
            'add',
            async (current) =>
                (
                    await api!.request(
                        'POST /api/v1/admin/allergens/{code}/mappings',
                        {
                            action: 'add',
                            subjectType: field('subjectType'),
                            subjectId: field('subjectId'),
                            status: field('status'),
                            source: field('source'),
                            mappingId: null,
                            expectedVersion: current.version,
                            idempotencyKey: crypto.randomUUID(),
                        },
                        undefined,
                        { code: current.code },
                    )
                ).data,
        );
    }
    async function remove(mapping: Mapping) {
        await mutate(
            `remove:${mapping.id}`,
            async (current) =>
                (
                    await api!.request(
                        'POST /api/v1/admin/allergens/{code}/mappings',
                        {
                            action: 'remove',
                            subjectType: mapping.subjectType,
                            subjectId: mapping.subjectId,
                            status: mapping.status,
                            source: mapping.source,
                            mappingId: mapping.id,
                            expectedVersion: current.version,
                            idempotencyKey: crypto.randomUUID(),
                        },
                        undefined,
                        { code: current.code },
                    )
                ).data,
        );
    }
    async function fallback(action: 'set_fallback' | 'remove') {
        await mutate(
            `icon:${action}`,
            async (current) =>
                (
                    await api!.request(
                        'PUT /api/v1/admin/allergens/{code}/icon',
                        {
                            action,
                            fallbackKey: `allergen-${current.code}`,
                            altText: `Пиктограмма: ${current.name}`,
                            expectedVersion: current.version,
                            idempotencyKey: crypto.randomUUID(),
                        },
                        undefined,
                        { code: current.code },
                    )
                ).data,
        );
    }
    async function upload(file: File) {
        const mime = file.type;
        if (!['image/png', 'image/webp', 'image/svg+xml'].includes(mime)) {
            setError('Выберите PNG, WebP или SVG.');
            return;
        }
        if (file.size > 1_048_576) {
            setError('Размер файла не должен превышать 1 МБ.');
            return;
        }
        let digest: ArrayBuffer;
        try {
            digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        } catch {
            setError('Не удалось прочитать и проверить файл.');
            return;
        }
        const checksumSha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
        if (uploadSimulation) {
            const { registerAllergenAsset } = await import('../../mocks/allergen-assets.js');
            registerAllergenAsset(checksumSha256, stagedIcon?.dataUrl ?? '');
        }
        const succeeded = await mutate(
            'upload',
            async (current) =>
                (
                    await api!.request(
                        'POST /api/v1/admin/allergens/{code}/icon/upload',
                        {
                            name: file.name,
                            mime,
                            size: file.size,
                            checksumSha256,
                            altText: `Пиктограмма: ${current.name}`,
                            expectedVersion: current.version,
                            idempotencyKey: crypto.randomUUID(),
                        },
                        undefined,
                        { code: current.code },
                    )
                ).data,
        );
        if (succeeded) setStagedIcon(null);
    }
    const uploadSimulation = import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock';
    return (
        <Guard context="admin">
            <AdminShell active="catalog">
                <header className={styles.heading}>
                    <p>Каталог / Аллергены</p>
                    <h1>Словарь аллергенов</h1>
                    <p>Связи ингредиентов и продуктов, статусы и пиктограммы для пользовательских предупреждений.</p>
                </header>
                <div className={styles.layout}>
                    <section className={styles.master} aria-label="Список аллергенов">
                        <form
                            className={styles.search}
                            onSubmit={(event) => {
                                event.preventDefault();
                                setQuery(search.trim());
                            }}
                        >
                            <label>
                                Поиск
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Название или код"
                                />
                            </label>
                            <button className="button outline">Найти</button>
                        </form>
                        <div className={styles.filters} aria-label="Фильтр связей">
                            {(['all', 'mapped', 'empty'] as const).map((value) => (
                                <button
                                    key={value}
                                    className={filter === value ? styles.active : ''}
                                    onClick={() => setFilter(value)}
                                >
                                    {value === 'all' ? 'Все' : value === 'mapped' ? 'Со связями' : 'Без связей'}
                                </button>
                            ))}
                        </div>
                        {list.isPending ? (
                            <p>Загружаем словарь…</p>
                        ) : list.isError ? (
                            <button className="button outline" onClick={() => void list.refetch()}>
                                Повторить загрузку
                            </button>
                        ) : (
                            <ul className={styles.list}>
                                {visible.map((item) => (
                                    <li key={item.code}>
                                        <Link
                                            to={`/admin/catalog/allergens/${item.code}`}
                                            className={selectedCode === item.code ? styles.selected : ''}
                                        >
                                            <img src={iconUrl(item.icon)} alt="" />
                                            <span>
                                                <strong>{item.name}</strong>
                                                <small>
                                                    {item.code} · {item.activeMappings} связей
                                                </small>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    <section className={styles.detail} aria-live="polite">
                        {!selectedCode ? (
                            <p>Выберите аллерген.</p>
                        ) : detail.isPending ? (
                            <p>Загружаем карточку…</p>
                        ) : detail.isError ? (
                            <button className="button outline" onClick={() => void detail.refetch()}>
                                Повторить загрузку
                            </button>
                        ) : (
                            detail.data && (
                                <>
                                    <div className={styles['detail-heading']}>
                                        <div>
                                            <p className={styles.code}>{detail.data.code}</p>
                                            <h2>{detail.data.name}</h2>
                                        </div>
                                        <span>Версия {detail.data.version}</span>
                                    </div>
                                    {error && (
                                        <p className={styles.error} role="alert">
                                            {error}
                                        </p>
                                    )}
                                    <section>
                                        <h3>Связи словаря</h3>
                                        <dl className={styles.counts}>
                                            <div>
                                                <dt>Ингредиенты</dt>
                                                <dd>{detail.data.ingredientMappings}</dd>
                                            </div>
                                            <div>
                                                <dt>Варианты</dt>
                                                <dd>{detail.data.variantMappings}</dd>
                                            </div>
                                            <div>
                                                <dt>Продукты</dt>
                                                <dd>{detail.data.productMappings}</dd>
                                            </div>
                                        </dl>
                                        <div className={styles.mappings}>
                                            {detail.data.mappings.map((mapping) => (
                                                <article key={mapping.id} className={styles.mapping}>
                                                    <img src={subjectImage(mapping)} alt="" />
                                                    <div>
                                                        <strong>{mapping.subjectName}</strong>
                                                        <p>
                                                            {subjectLabels[mapping.subjectType]} ·{' '}
                                                            {statusLabels[mapping.status]}
                                                        </p>
                                                        <small>{mapping.source}</small>
                                                    </div>
                                                    <button
                                                        className="button outline"
                                                        disabled={!!pending}
                                                        onClick={() => void remove(mapping)}
                                                    >
                                                        {pending === `remove:${mapping.id}` ? (
                                                            <ArcInlineLoader label="Удаляем" />
                                                        ) : (
                                                            'Удалить'
                                                        )}
                                                    </button>
                                                </article>
                                            ))}
                                        </div>
                                        <form className={styles['add-form']} onSubmit={(event) => void add(event)}>
                                            <h4>Добавить связь</h4>
                                            <label>
                                                Тип
                                                <select
                                                    name="subjectType"
                                                    value={subjectType}
                                                    onChange={(event) => {
                                                        setSubjectType(event.target.value as Mapping['subjectType']);
                                                        setSubjectId('');
                                                    }}
                                                >
                                                    <option value="ingredient">Ингредиент</option>
                                                    <option value="product">Продукт</option>
                                                    <option value="variant">Вариант</option>
                                                </select>
                                            </label>
                                            <label>
                                                Поиск по названию
                                                <input
                                                    value={subjectSearch}
                                                    maxLength={100}
                                                    onChange={(event) => setSubjectSearch(event.target.value)}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                className="button outline"
                                                onClick={() => {
                                                    setSubjectQuery(subjectSearch.trim());
                                                    setSubjectId('');
                                                }}
                                            >
                                                Найти в каталоге
                                            </button>
                                            <label>
                                                Продукт или ингредиент
                                                <select
                                                    name="subjectId"
                                                    required
                                                    value={subjectId}
                                                    disabled={subjects.isPending || subjects.isError}
                                                    onChange={(event) => setSubjectId(event.target.value)}
                                                >
                                                    <option value="">Выберите из списка</option>
                                                    {subjects.data?.items.map((subject) => (
                                                        <option key={subject.subjectId} value={subject.subjectId}>
                                                            {subject.subjectName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            {subjects.isPending && <p role="status">Ищем в каталоге…</p>}
                                            {subjects.isError && (
                                                <button
                                                    type="button"
                                                    className="button outline"
                                                    onClick={() => void subjects.refetch()}
                                                >
                                                    Повторить поиск
                                                </button>
                                            )}
                                            {subjects.data?.items.length === 0 && (
                                                <p role="status">Совпадений нет. Измените название или тип.</p>
                                            )}
                                            <label>
                                                Статус
                                                <select name="status">
                                                    <option value="contains">Содержит</option>
                                                    <option value="may_contain">Может содержать</option>
                                                    <option value="unknown">Нет данных</option>
                                                </select>
                                            </label>
                                            <label>
                                                Источник
                                                <input
                                                    name="source"
                                                    required
                                                    defaultValue="Ручная проверка администратора"
                                                />
                                            </label>
                                            <button
                                                className="button"
                                                disabled={
                                                    !!pending || !subjectId || subjects.isPending || subjects.isError
                                                }
                                            >
                                                {pending === 'add' ? (
                                                    <ArcInlineLoader label="Добавляем" />
                                                ) : (
                                                    'Добавить связь'
                                                )}
                                            </button>
                                        </form>
                                    </section>
                                    <section className={styles.icons}>
                                        <h3>Пиктограмма</h3>
                                        <div className={styles.preview}>
                                            <img src={iconUrl(detail.data.icon)} alt={detail.data.icon.alt} />
                                            <div>
                                                <strong>
                                                    {detail.data.icon.state === 'custom'
                                                        ? 'Пользовательская'
                                                        : detail.data.icon.state === 'fallback'
                                                          ? 'Стандартная'
                                                          : 'Не задана'}
                                                </strong>
                                                <p>{detail.data.icon.alt}</p>
                                            </div>
                                        </div>
                                        <div className={styles.actions}>
                                            <label className="button outline">
                                                {pending === 'upload'
                                                    ? 'Загружаем…'
                                                    : detail.data.icon.state === 'custom'
                                                      ? 'Заменить файл'
                                                      : 'Загрузить файл'}
                                                <input
                                                    type="file"
                                                    accept="image/png,image/webp,image/svg+xml"
                                                    disabled={!uploadSimulation || !!pending}
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0];
                                                        if (!file) return;
                                                        if (file.size > 1_048_576) {
                                                            setError('Размер файла не должен превышать 1 МБ.');
                                                            return;
                                                        }
                                                        const reader = new FileReader();
                                                        reader.onload = () => {
                                                            if (typeof reader.result === 'string')
                                                                setStagedIcon({
                                                                    code: detail.data.code,
                                                                    file,
                                                                    dataUrl: reader.result,
                                                                });
                                                        };
                                                        reader.onerror = () => setError('Не удалось прочитать файл.');
                                                        reader.readAsDataURL(file);
                                                    }}
                                                />
                                            </label>
                                            <button
                                                className="button outline"
                                                disabled={!!pending}
                                                onClick={() => void fallback('set_fallback')}
                                            >
                                                Стандартная
                                            </button>
                                            <button
                                                className="button outline"
                                                disabled={!!pending}
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            'Удалить пользовательскую иконку и вернуть стандартную?',
                                                        )
                                                    )
                                                        void fallback('remove');
                                                }}
                                            >
                                                Удалить
                                            </button>
                                        </div>
                                        {stagedIcon?.code === detail.data.code && (
                                            <div className={styles['staged-icon']}>
                                                <div>
                                                    <small>Текущая</small>
                                                    <img src={iconUrl(detail.data.icon)} alt={detail.data.icon.alt} />
                                                </div>
                                                <div>
                                                    <small>Новая</small>
                                                    <img
                                                        src={stagedIcon.dataUrl}
                                                        alt="Предпросмотр новой пиктограммы"
                                                    />
                                                </div>
                                                <button
                                                    className="button"
                                                    disabled={!!pending}
                                                    onClick={() => void upload(stagedIcon.file)}
                                                >
                                                    Подтвердить загрузку
                                                </button>
                                                <button
                                                    className="button outline"
                                                    disabled={!!pending}
                                                    onClick={() => setStagedIcon(null)}
                                                >
                                                    Отмена
                                                </button>
                                            </div>
                                        )}
                                        {!uploadSimulation && (
                                            <p className={styles.notice}>{detail.data.iconUpload.reason}</p>
                                        )}
                                        {uploadSimulation && (
                                            <p className={styles.notice}>
                                                Development mock: файл проверяется локально, загрузка и замена доступны
                                                без внешнего хранилища.
                                            </p>
                                        )}
                                    </section>
                                </>
                            )
                        )}
                    </section>
                </div>
            </AdminShell>
        </Guard>
    );
}
