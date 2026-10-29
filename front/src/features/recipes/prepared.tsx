'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import { useSession } from '../../entities/session/client.js';
import { RecipeShell, RecipeLoading, RecipeError } from './shared.js';
import { recipeUnits } from '../../entities/recipe/model.js';
import styles from './workspace.module.css';
function Content() {
    const { api } = useRuntime();
    const user = useSession('user');
    const search = useSearchParams();
    const batch = search.get('batch');
    const query = useQuery({
        queryKey: ['cooking', user.data?.id, 'stock-options'],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/cooking-attempts/stock-options', undefined, signal)).data,
    });
    return (
        <>
            <Link href="/inventory">← Запасы</Link>
            <h1>Готовые блюда и заготовки</h1>
            <p>Личная область. Результаты подтверждённых приготовлений.</p>
            {query.isPending ? (
                <RecipeLoading />
            ) : query.isError ? (
                <RecipeError error={query.error} retry={() => void query.refetch()} />
            ) : (
                <div className={styles.stack}>
                    {query.data.items
                        .filter((row) => row.kind !== 'ingredient' && (!batch || row.id === batch))
                        .map((row) => (
                            <article className={styles.panel} key={row.id}>
                                <h2>{row.name}</h2>
                                <p>
                                    {row.quantity ?? 'Количество неизвестно'}{' '}
                                    {row.unit ? (recipeUnits[row.unit] ?? row.unit) : 'Единица неизвестна'}
                                </p>
                                <p>{row.kind === 'preserve' ? 'Промежуточная заготовка' : 'Готовое блюдо'}</p>
                                {row.sourceRecipeId && (
                                    <Link href={`/recipes/${row.sourceRecipeId}`}>Исходный рецепт</Link>
                                )}
                                <Link href={`/inventory/history?batchId=${row.id}`}>История расхода и поступления</Link>
                            </article>
                        ))}
                    {!query.data.items.some((row) => row.kind !== 'ingredient' && (!batch || row.id === batch)) && (
                        <p>Готовых партий пока нет или партия недоступна.</p>
                    )}
                </div>
            )}
        </>
    );
}
export function PreparedStocks() {
    return (
        <RecipeShell>
            <Content />
        </RecipeShell>
    );
}
