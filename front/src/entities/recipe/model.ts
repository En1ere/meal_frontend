export const recipeUnits: Record<string, string> = {
    g: 'г',
    kg: 'кг',
    ml: 'мл',
    l: 'л',
    pcs: 'шт.',
    pack: 'уп.',
    serv: 'порц.',
};

export const categoryLabels: Record<string, string> = {
    breakfast: 'Завтраки',
    soups: 'Супы',
    mains: 'Основные блюда',
    salads: 'Салаты',
    baking: 'Выпечка',
    desserts: 'Десерты',
    snacks: 'Закуски',
    sauces: 'Соусы',
};

export const methodLabels: Record<string, string> = {
    stovetop: 'На плите',
    oven: 'В духовке',
    baking: 'Выпекание',
    boiling: 'Варка',
    frying: 'Жарка',
    steaming: 'На пару',
    raw: 'Без нагрева',
    no_cook: 'Без нагрева',
    grill: 'На гриле',
};

export function recipeRatingText(rating: number | null, count: number) {
    return rating !== null && count > 0
        ? `★ ${rating.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} (${count})`
        : 'Пока нет оценок';
}

export function isRecipeImageSourceAllowed(src: string | null): src is string {
    return !!src && (/^\/(?!\/)/u.test(src) || /^https:\/\//u.test(src));
}
