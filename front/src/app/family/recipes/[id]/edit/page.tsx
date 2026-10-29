import { RecipeEditor } from '../../../../../features/recipes/client.js';

export const metadata = { title: 'Редактор семейного рецепта', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <RecipeEditor id={id} scope="family" />;
}
