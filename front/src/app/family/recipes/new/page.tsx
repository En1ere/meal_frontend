import { RecipeEditor } from '../../../../features/recipes/editor.js';

export const metadata = { title: 'Новый семейный рецепт', robots: { index: false, follow: false } };

export default function Page() {
    return <RecipeEditor scope="family" />;
}
