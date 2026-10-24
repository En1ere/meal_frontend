'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import { RecipeShell, RecipeLoading, RecipeError } from './shared.js';
import styles from './workspace.module.css';
function Content() {
    const { api } = useRuntime();
    const user = useSession('user');
    const search = useSearchParams();
    const page = Math.max(1, Number(search.get('page')) || 1);
    const query = useQuery({
        queryKey: ['recipe-community', user.data?.id, 'reports', page],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/recipe-workspace/reports', undefined, signal, undefined, {
                    query: { page: String(page), limit: '20' },
                })
            ).data,
    });
    return (
        <>
            <Link href="/recipes">← Рецепты</Link>
            <h1>Мои жалобы на рецепты</h1>
            <p>История обращений остаётся доступной, даже если рецепт скрыт.</p>
            {query.isPending ? (
                <RecipeLoading />
            ) : query.isError ? (
                <RecipeError error={query.error} retry={() => void query.refetch()} />
            ) : (
                <div className={styles.stack}>
                    {query.data.items.map((row) => (
                        <article className={styles.panel} key={row.id}>
                            <p>
                                <Link href={`/reports/${row.id}`}>Обращение {row.id}</Link>
                            </p>
                            <p>{row.status === 'pending' ? 'На рассмотрении' : row.status}</p>
                            <time dateTime={row.submittedAt}>{new Date(row.submittedAt).toLocaleString('ru-RU')}</time>
                            <Link href={`/recipes/${row.recipeId}`}>Проверить доступность рецепта</Link>
                        </article>
                    ))}
                    {!query.data.items.length && <p>Жалоб пока нет.</p>}
                    <nav className={styles.actions}>
                        {page > 1 && <Link href={`/reports?page=${page - 1}`}>Назад</Link>}
                        {page * 20 < query.data.total && <Link href={`/reports?page=${page + 1}`}>Далее</Link>}
                    </nav>
                </div>
            )}
        </>
    );
}
export function RecipeReports() {
    return (
        <Guard context="user">
            <RecipeShell>
                <Content />
            </RecipeShell>
        </Guard>
    );
}
function DetailContent({ id }: { id: string }) {
    const { api } = useRuntime();
    const user = useSession('user');
    const query = useQuery({
        queryKey: ['recipe-report', user.data?.id, id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/recipe-workspace/reports/{id}', undefined, signal, { id })).data,
    });
    return (
        <>
            <Link href="/reports">← Мои жалобы</Link>
            <h1>Карточка жалобы</h1>
            {query.isPending ? (
                <RecipeLoading />
            ) : query.isError ? (
                <RecipeError error={query.error} retry={() => void query.refetch()} />
            ) : (
                <section className={styles.panel}>
                    <p>Статус: {query.data.status}</p>
                    <p>Причина: {query.data.reason}</p>
                    <p>
                        Подана:{' '}
                        <time dateTime={query.data.submittedAt}>
                            {new Date(query.data.submittedAt).toLocaleString('ru-RU')}
                        </time>
                    </p>
                    {query.data.recipeId ? (
                        <Link href={`/recipes/${query.data.recipeId}`}>Открыть доступный рецепт</Link>
                    ) : (
                        <p>Связанный объект скрыт или недоступен.</p>
                    )}
                    <p>Личность заявителя не показывается автору контента.</p>
                </section>
            )}
        </>
    );
}
export function RecipeReportDetail({ id }: { id: string }) {
    return (
        <Guard context="user">
            <RecipeShell>
                <DetailContent id={id} />
            </RecipeShell>
        </Guard>
    );
}
