import { MyRecipes } from '../../../features/recipes/mine.js';

export const metadata = { title: 'Рецепты семьи', robots: { index: false, follow: false } };

export default function Page() {
    return <MyRecipes scope="family" />;
}
