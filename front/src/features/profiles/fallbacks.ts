/** Presentation fallbacks never infer public identity from private data. */
export const profileFallbacks = {
    username: 'Автор',
    displayName: 'Имя не указано',
    email: 'Email недоступен',
    timezone: 'Часовой пояс не выбран',
    locale: 'Язык не выбран',
    theme: 'Используется тема приложения',
    recipeCount: 'Количество рецептов пока недоступно',
    reputationLabel: 'Статус пока недоступен',
    achievements: 'Информация о достижениях пока недоступна',
    avatarUrl: 'Аватар не добавлен',
} as const;
export function profileText(value: string | null | undefined, fallback: string): string {
    return value?.trim() || fallback;
}
export function recipeCountText(value: number | null | undefined): string {
    return value == null ? profileFallbacks.recipeCount : `Опубликованных рецептов: ${value}`;
}
