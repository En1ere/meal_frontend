import { FamilyRecipeDetail } from '../../../../features/recipes/family-detail.js';

export const metadata = { title: 'Семейный рецепт', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <FamilyRecipeDetail id={id} />;
}
