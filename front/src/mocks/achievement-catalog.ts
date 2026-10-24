export const reputationRanks = [
    { id: 'newcomer', title: 'Новичок', minimumScore: 0 },
    { id: 'participant', title: 'Участник', minimumScore: 25 },
    { id: 'helper', title: 'Помощник', minimumScore: 75 },
    { id: 'expertise', title: 'Знаток', minimumScore: 150 },
    { id: 'author', title: 'Автор', minimumScore: 300 },
    { id: 'expert', title: 'Эксперт', minimumScore: 600 },
    { id: 'mentor', title: 'Наставник', minimumScore: 1000 },
    { id: 'master', title: 'Мастер', minimumScore: 1750 },
    { id: 'community-chef', title: 'Шеф сообщества', minimumScore: 3000 },
    { id: 'legend', title: 'Легенда', minimumScore: 5000 },
] as const;

export const achievementCategories = [
    { id: 'culinary', title: 'Кулинарные' },
    { id: 'planning', title: 'Запасы и план' },
    { id: 'author', title: 'Авторские' },
    { id: 'community', title: 'Сообщество и каталог' },
    { id: 'family', title: 'Коллекции и семья' },
    { id: 'seasonal', title: 'Сезонные и секретные' },
] as const;

const catalog = [
    ['first-dish', 'culinary', 'Первое блюдо', 'Завершить первую готовку'],
    ['home-cook', 'culinary', 'Домашний повар', 'Завершить 10 готовок'],
    ['confident-cook', 'culinary', 'Уверенный повар', 'Завершить 50 готовок'],
    ['hundred-dishes', 'culinary', 'Сотня блюд', 'Завершить 100 готовок'],
    ['new-flavors', 'culinary', 'Новые вкусы', 'Приготовить 10 разных рецептов'],
    ['culinary-outlook', 'culinary', 'Кулинарный кругозор', 'Приготовить 25 разных рецептов'],
    ['breakfast-ready', 'culinary', 'Завтрак готов', 'Приготовить 7 разных завтраков'],
    ['soup-week', 'culinary', 'Суповая неделя', 'Приготовить 5 разных супов'],
    ['home-baking', 'culinary', 'Домашняя выпечка', 'Приготовить 5 рецептов выпечки'],
    ['sweet-collection', 'culinary', 'Сладкая коллекция', 'Приготовить 5 разных десертов'],
    ['vegetable-season', 'culinary', 'Овощной сезон', 'Приготовить 10 блюд с овощной основой'],
    ['fish-day', 'culinary', 'Рыбный день', 'Приготовить 5 разных рыбных блюд'],
    ['plant-menu', 'culinary', 'Растительное меню', 'Приготовить 10 растительных блюд'],
    ['world-cuisines', 'culinary', 'Кухни мира', 'Приготовить рецепты пяти кухонь'],
    ['no-extra-waste', 'culinary', 'Без лишних отходов', 'Пять раз подтвердить использование остатков'],
    ['first-batch', 'planning', 'Первая партия', 'Добавить первую подтверждённую партию'],
    ['kitchen-order', 'planning', 'Порядок на кухне', 'Указать место для 10 разных партий'],
    ['full-pantry', 'planning', 'Полная кладовая', 'Вести 50 активных партий'],
    ['week-without-expiry', 'planning', 'Неделя без просрочек', 'Семь дней без новой просрочки при активных запасах'],
    ['weekly-plan', 'planning', 'План на неделю', 'Заполнить семь разных дней одного плана'],
    ['month-by-plan', 'planning', 'Месяц по плану', 'Завершить четыре недельных плана'],
    ['shopping-by-list', 'planning', 'Покупки по списку', 'Завершить список с фактической покупкой'],
    ['ten-lists', 'planning', 'Десять списков', 'Завершить 10 списков покупок'],
    ['receipt-accepted', 'planning', 'Чек принят', 'Обработать первый подтверждённый чек'],
    ['homemade-preserve', 'planning', 'Заготовлено дома', 'Создать первую заготовку'],
    ['first-recipe', 'author', 'Первый рецепт', 'Опубликовать первый самостоятельный рецепт'],
    ['five-recipes', 'author', 'Пять рецептов', 'Опубликовать 5 самостоятельных рецептов'],
    ['author-ten', 'author', 'Авторская десятка', 'Опубликовать 10 самостоятельных рецептов'],
    ['big-book', 'author', 'Большая книга', 'Опубликовать 25 самостоятельных рецептов'],
    ['complete-card', 'author', 'Полная карточка', 'Опубликовать рецепт со всеми обязательными подробностями'],
    ['first-reader', 'author', 'Первый читатель', 'Рецепт приготовил независимый пользователь'],
    ['kitchen-tested', 'author', 'Проверено на кухне', 'Рецепт приготовили 5 разных пользователей'],
    ['peoples-recipe', 'author', 'Народный рецепт', 'Рецепт приготовили 25 разных пользователей'],
    ['hundred-home-kitchens', 'author', 'Сто домашних кухонь', 'Рецепт приготовили 100 разных пользователей'],
    ['own-series', 'author', 'Собственная серия', 'Опубликовать 5 рецептов одной авторской подборки'],
    ['good-advice', 'community', 'Добрый совет', 'Получить подтверждение полезного комментария'],
    ['ten-good-tips', 'community', 'Десять добрых советов', 'Получить 10 подтверждений полезных комментариев'],
    ['first-follower', 'community', 'Первый подписчик', 'Получить первого подписчика'],
    ['readers-circle', 'community', 'Круг читателей', 'Получить 25 подписчиков'],
    ['useful-clarification', 'community', 'Полезное уточнение', 'Подтверждено первое содержательное исправление'],
    ['catalog-helper', 'community', 'Помощник каталога', 'Подтверждено 10 содержательных исправлений'],
    ['catalog-expert', 'community', 'Эксперт каталога', 'Подтверждено 50 содержательных исправлений'],
    ['allergen-noticed', 'community', 'Аллерген замечен', 'Подтверждено сообщение о пропущенном аллергене'],
    ['reliable-source', 'community', 'Надёжный источник', 'Подтверждено 5 дополнений источниками'],
    ['good-photo', 'community', 'Хорошая фотография', 'Принято первое улучшение изображения товара или рецепта'],
    ['first-find', 'family', 'Первая находка', 'Сохранить первый рецепт'],
    ['personal-ten', 'family', 'Личная десятка', 'Сохранить 10 разных рецептов'],
    ['big-collection', 'family', 'Большая коллекция', 'Сохранить 50 разных рецептов'],
    ['favorite-authors', 'family', 'Любимые авторы', 'Подписаться на 10 авторов'],
    ['shared-list', 'family', 'Общий список', 'Завершить первый семейный список покупок'],
    ['family-dinner', 'family', 'Семейный ужин', 'Семья подтверждает одну общую готовку'],
    ['week-together', 'family', 'Неделя вместе', 'Заполнить семейный план на семь дней'],
    ['team-kitchen', 'family', 'Командная кухня', 'Три участника семьи завершают готовки за одну неделю'],
    ['seasonal-table', 'seasonal', 'Сезонный стол', 'Приготовить 5 активных сезонных рецептов'],
    ['holiday-table', 'seasonal', 'Праздничный стол', 'Завершить праздничную подборку в период события'],
    ['harvest-month', 'seasonal', 'Урожайный месяц', 'Приготовить 10 сезонных блюд за календарный месяц'],
    ['early-breakfast', 'seasonal', 'Ранний завтрак', 'Секретное условие, раскрывается после получения'],
    ['night-cook', 'seasonal', 'Ночной повар', 'Секретное условие, раскрывается после получения'],
    ['precise-calculation', 'seasonal', 'Точный расчёт', 'Секретное условие, раскрывается после получения'],
    ['everything-used', 'seasonal', 'Всё пригодилось', 'Секретное условие, раскрывается после получения'],
] as const;

const fallbackByCategory: Record<string, string> = {
    culinary: 'achievement-culinary',
    planning: 'achievement-planning',
    author: 'achievement-author',
    community: 'achievement-community',
    family: 'achievement-family',
    seasonal: 'achievement-seasonal',
};

export const achievementDefinitions = catalog.map(([id, category, title, description], index) => ({
    id,
    title,
    description,
    category,
    icon: { assetId: null, fallbackKey: fallbackByCategory[category]!, alt: `${title} — значок достижения` },
    secret: index >= 56,
}));

export function mockPublicProgress(username: string, avatarUrl: string | null) {
    const normalized = username.trim().toLowerCase();
    const seed = Array.from(normalized).reduce((sum, character) => sum + character.codePointAt(0)!, 0);
    const score = normalized === 'marina_cooks' ? 742 : 20 + ((seed * 37) % 3700);
    const rankIndex = reputationRanks.findLastIndex((rank) => score >= rank.minimumScore);
    const rank = reputationRanks[Math.max(0, rankIndex)]!;
    const nextRank = reputationRanks[rankIndex + 1] ?? null;
    const earnedCount = Math.min(achievementDefinitions.length, Math.max(3, Math.floor(score / 70)));
    return {
        profile: { username: normalized, avatarUrl },
        reputation: { score, rank: { ...rank, nextMinimumScore: nextRank?.minimumScore ?? null } },
        categories: achievementCategories,
        achievements: achievementDefinitions.map((definition, index) => ({
            ...definition,
            status: index < earnedCount ? ('earned' as const) : ('locked' as const),
            earnedAt: index < earnedCount ? new Date(Date.UTC(2026, 8, 7 - (index % 7))).toISOString() : null,
        })),
    };
}
