'use client';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useSession } from '../../entities/session/client.js';
import { RecipeShell } from './shared.js';
import { recipeUnits } from '../../entities/recipe/model.js';
import { readRecipeCache, recipeCacheKey } from '../../entities/recipe-cache/model.js';
import { readOfflineOwner, subscribeOfflineState } from '../../entities/offline/store.js';
const subscribe = (callback: () => void) => {
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
};
const snapshot = () => {
    try {
        return localStorage.getItem(recipeCacheKey);
    } catch {
        return null;
    }
};
export function SavedRecipesReader() {
    const session = useSession('user');
    const raw = useSyncExternalStore(subscribe, snapshot, () => null);
    const online = useSyncExternalStore(
        subscribeOfflineState,
        () => navigator.onLine,
        () => true,
    );
    const owner = session.data?.id ?? (!online ? readOfflineOwner() : null);
    const items = owner ? readRecipeCache({ getItem: () => raw }, owner) : [];
    return (
        <section>
            <h1>Сохранённые рецепты</h1>
            <p>
                Два последних открытых рецепта. Это снимки для чтения: наличие продуктов, оценки и другие данные могли
                измениться. Запись требует подключения.
            </p>
            <p>
                В real-режиме страница и необходимые файлы приложения сохраняются локально. После первой успешной
                загрузки этот список можно открыть без сети.
            </p>
            {!online && owner && <p role="status">Показана локальная копия для последнего подтверждённого аккаунта.</p>}
            <p>
                <Link href="/settings/offline">Управление локальными данными</Link>
            </p>
            {items.map((item) => (
                <article key={item.recipe.id}>
                    <h2>{item.recipe.title}</h2>
                    <p>Сохранено {new Date(item.savedAt).toLocaleString('ru-RU')}</p>
                    <p>{item.recipe.description}</p>
                    <h3>Ингредиенты · {item.recipe.baseServings} порций</h3>
                    <ul>
                        {item.recipe.ingredients.map((row) => (
                            <li key={row.id}>
                                {row.name}: {row.quantity ?? 'Количество неизвестно'}{' '}
                                {row.unit ? (recipeUnits[row.unit] ?? row.unit) : ''}
                            </li>
                        ))}
                    </ul>
                    <h3>Шаги</h3>
                    <ol>
                        {item.recipe.steps.map((row) => (
                            <li key={row.id}>{row.text}</li>
                        ))}
                    </ol>
                    <Link href={`/recipes/${item.recipe.id}`}>Открыть актуальную карточку</Link>
                </article>
            ))}
            {!owner && !online && <p>Подключитесь к сети и войдите, чтобы подтвердить аккаунт на этом устройстве.</p>}
            {owner && !items.length && <p>Для этого аккаунта сохранённых рецептов нет.</p>}
        </section>
    );
}
export function OfflineRecipes() {
    return (
        <RecipeShell>
            <SavedRecipesReader />
        </RecipeShell>
    );
}
