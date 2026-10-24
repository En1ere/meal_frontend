import { OfflineRecipes } from '../../../features/recipes/offline.js';
export const metadata = { title: 'Сохранённые рецепты', robots: { index: false, follow: false } };
export default function Page() {
    return <OfflineRecipes />;
}
