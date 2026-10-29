import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RecipeDetail } from '../../../features/recipes/client.js';
import { getPublicRecipe } from '../../../shared/recipes/public-recipe.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { recipeShellClassName } from '../../../features/recipes/server.js';
import { UserAppShell } from '../../../widgets/user-app-shell/client.js';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const result = await getPublicRecipe(id);
    if (result.kind !== 'found') return { title: 'Рецепт недоступен', robots: { index: false, follow: false } };
    return {
        title: result.recipe.title,
        description: result.recipe.description ?? 'Ингредиенты и шаги приготовления.',
        alternates: { canonical: `/recipes/${id}` },
    };
}
export default async function Page({ params }: Props) {
    const { id } = await params;
    const result = await getPublicRecipe(id);
    if (result.kind === 'missing') notFound();
    // A temporary backend failure is retryable and must never masquerade as a missing recipe.
    return (
        <Suspense fallback={<ArcPageLoader label="Открываем рецепт…" />}>
            <UserAppShell scope="personal" contentClassName={recipeShellClassName(true)}>
                <RecipeDetail id={id} {...(result.kind === 'found' ? { initialData: result.recipe } : {})} />
            </UserAppShell>
        </Suspense>
    );
}
