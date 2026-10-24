'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { Guard, useSession } from '../auth/session.js';
import { RecipeError, RecipeLoading, RecipeShell, recipeUnits } from './shared.js';
import styles from './workspace.module.css';

function Content({ id }: { id: string }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const recipe = useQuery({
        queryKey: ['recipe-workspace', session.data?.id, 'family', id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request(
                    'GET /api/v1/recipe-workspace/{id}',
                    undefined,
                    signal,
                    { id },
                    {
                        query: { scope: 'family' },
                    },
                )
            ).data.recipe,
    });
    const products = useQuery({
        queryKey: ['products', 'family-recipe', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/products', undefined, signal, undefined, { query: { limit: '100' } })).data
                .items,
    });
    if (recipe.isPending) return <RecipeLoading />;
    if (recipe.isError) return <RecipeError error={recipe.error} retry={() => void recipe.refetch()} />;
    const value = recipe.data;
    return (
        <div className={styles.stack}>
            <Link href="/family/recipes">← Рецепты семьи</Link>
            <section className={styles.panel}>
                <div className={styles.actions}>
                    <div>
                        <p>Семейный рецепт</p>
                        <h1>{value.document.title || 'Без названия'}</h1>
                    </div>
                    {value.canEdit && (
                        <Link className="button" href={`/family/recipes/${value.id}/edit`}>
                            Редактировать
                        </Link>
                    )}
                </div>
                <p>{value.document.description || 'Автор пока не добавил описание.'}</p>
                <p>
                    Автор: @{value.authorLogin ?? 'профиль недоступен'} · {value.document.baseServings} порций ·
                    Редакция {value.revision}
                </p>
            </section>
            <section className={styles.panel}>
                <h2>Ингредиенты</h2>
                {value.document.ingredients.length ? (
                    <ol>
                        {value.document.ingredients.map((ingredient, index) => {
                            const known = products.data?.find((product) => product.id === ingredient.ingredientId);
                            return (
                                <li
                                    key={`${ingredient.ingredientId ?? ingredient.variantId ?? ingredient.productId ?? ingredient.sourceRecipeId}:${index}`}
                                >
                                    {known?.name ?? `Ингредиент ${index + 1}`}:{' '}
                                    {ingredient.quantity ?? 'количество не указано'}{' '}
                                    {ingredient.unit ? (recipeUnits[ingredient.unit] ?? ingredient.unit) : ''}
                                    {ingredient.optional ? ' · необязательно' : ''}
                                </li>
                            );
                        })}
                    </ol>
                ) : (
                    <p>Ингредиенты пока не добавлены.</p>
                )}
            </section>
            <section className={styles.panel}>
                <h2>Шаги</h2>
                {value.document.steps.length ? (
                    <ol>
                        {value.document.steps.map((step, index) => (
                            <li key={index}>{step.text || 'Шаг не заполнен'}</li>
                        ))}
                    </ol>
                ) : (
                    <p>Шаги пока не добавлены.</p>
                )}
            </section>
            <p>Рецепт доступен активным участникам семьи. Редактировать его может только автор.</p>
        </div>
    );
}

export function FamilyRecipeDetail({ id }: { id: string }) {
    return (
        <Guard context="user">
            <RecipeShell family>
                <Content id={id} />
            </RecipeShell>
        </Guard>
    );
}
