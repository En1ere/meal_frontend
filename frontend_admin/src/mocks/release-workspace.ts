import { z } from 'zod';
import {
    releaseCommandSchema,
    releaseSchema,
    releaseWorkspaceSchema,
    type Achievement,
    type AchievementCondition,
    type AchievementMetric,
    type ReleaseAck,
    type ReleaseChange,
    type ReleaseCommand,
    type ReleaseWorkspace,
} from '../features/releases/contracts.js';

const id = (prefix: number, value: number) =>
    `${String(prefix).padStart(8, '0')}-0000-4000-8000-${String(value).padStart(12, '0')}`;
const now = '2026-10-06T09:00:00.000Z';
const groups = [
    [
        'culinary',
        [
            ['Первое блюдо', 'Завершить первую готовку'],
            ['Домашний повар', 'Завершить 10 готовок'],
            ['Уверенный повар', 'Завершить 50 готовок'],
            ['Сотня блюд', 'Завершить 100 готовок'],
            ['Новые вкусы', 'Приготовить 10 разных рецептов'],
            ['Кулинарный кругозор', 'Приготовить 25 разных рецептов'],
            ['Завтрак готов', 'Приготовить 7 разных завтраков'],
            ['Суповая неделя', 'Приготовить 5 разных супов'],
            ['Домашняя выпечка', 'Приготовить 5 рецептов выпечки'],
            ['Сладкая коллекция', 'Приготовить 5 разных десертов'],
            ['Овощной сезон', 'Приготовить 10 блюд с овощной основой'],
            ['Рыбный день', 'Приготовить 5 разных рыбных блюд'],
            ['Растительное меню', 'Приготовить 10 растительных блюд'],
            ['Кухни мира', 'Приготовить рецепты пяти кухонь'],
            ['Без лишних отходов', 'Пять раз подтвердить использование остатков'],
        ],
    ],
    [
        'inventory_planning',
        [
            ['Первая партия', 'Добавить первую подтверждённую партию'],
            ['Порядок на кухне', 'Указать место для 10 разных партий'],
            ['Полная кладовая', 'Вести 50 активных партий'],
            ['Неделя без просрочек', 'Семь дней без новой просрочки при активных запасах'],
            ['План на неделю', 'Заполнить семь разных дней одного плана'],
            ['Месяц по плану', 'Завершить четыре недельных плана'],
            ['Покупки по списку', 'Завершить список с фактической покупкой'],
            ['Десять списков', 'Завершить 10 списков покупок'],
            ['Чек принят', 'Обработать первый подтверждённый чек'],
            ['Заготовлено дома', 'Создать первую заготовку'],
        ],
    ],
    [
        'author',
        [
            ['Первый рецепт', 'Опубликовать первый самостоятельный рецепт'],
            ['Пять рецептов', 'Опубликовать 5 самостоятельных рецептов'],
            ['Авторская десятка', 'Опубликовать 10 самостоятельных рецептов'],
            ['Большая книга', 'Опубликовать 25 самостоятельных рецептов'],
            ['Полная карточка', 'Опубликовать рецепт со всеми обязательными подробностями'],
            ['Первый читатель', 'Рецепт приготовил независимый пользователь'],
            ['Проверено на кухне', 'Рецепт приготовили 5 разных пользователей'],
            ['Народный рецепт', 'Рецепт приготовили 25 разных пользователей'],
            ['Сто домашних кухонь', 'Рецепт приготовили 100 разных пользователей'],
            ['Собственная серия', 'Опубликовать 5 рецептов одной авторской подборки'],
        ],
    ],
    [
        'community_catalog',
        [
            ['Добрый совет', 'Получить подтверждение полезного комментария'],
            ['Десять добрых советов', 'Получить 10 подтверждений полезных комментариев'],
            ['Первый подписчик', 'Получить первого подписчика'],
            ['Круг читателей', 'Получить 25 подписчиков'],
            ['Полезное уточнение', 'Подтверждено первое содержательное исправление'],
            ['Помощник каталога', 'Подтверждено 10 содержательных исправлений'],
            ['Эксперт каталога', 'Подтверждено 50 содержательных исправлений'],
            ['Аллерген замечен', 'Подтверждено сообщение о пропущенном аллергене'],
            ['Надёжный источник', 'Подтверждено 5 дополнений источниками'],
            ['Хорошая фотография', 'Принято первое улучшение изображения товара или рецепта'],
        ],
    ],
    [
        'collections_family',
        [
            ['Первая находка', 'Сохранить первый рецепт'],
            ['Личная десятка', 'Сохранить 10 разных рецептов'],
            ['Большая коллекция', 'Сохранить 50 разных рецептов'],
            ['Любимые авторы', 'Подписаться на 10 авторов'],
            ['Общий список', 'Завершить первый семейный список покупок'],
            ['Семейный ужин', 'Семья подтверждает одну общую готовку'],
            ['Неделя вместе', 'Заполнить семейный план на семь дней'],
            ['Командная кухня', 'Три участника семьи завершают готовки за одну неделю'],
        ],
    ],
    [
        'seasonal_secret',
        [
            ['Сезонный стол', 'Приготовить 5 активных сезонных рецептов'],
            ['Праздничный стол', 'Завершить праздничную подборку в период события'],
            ['Урожайный месяц', 'Приготовить 10 сезонных блюд за календарный месяц'],
            ['Ранний завтрак', 'Секретное условие, раскрывается после получения'],
            ['Ночной повар', 'Секретное условие, раскрывается после получения'],
            ['Точный расчёт', 'Секретное условие, раскрывается после получения'],
            ['Всё пригодилось', 'Секретное условие, раскрывается после получения'],
        ],
    ],
] as const;
const initialCodes = [
    'first-dish',
    'home-cook',
    'confident-cook',
    'hundred-dishes',
    'new-flavors',
    'culinary-outlook',
    'breakfast-ready',
    'soup-week',
    'home-baking',
    'sweet-collection',
    'vegetable-season',
    'fish-day',
    'plant-menu',
    'world-cuisines',
    'no-extra-waste',
    'first-batch',
    'kitchen-order',
    'full-pantry',
    'week-without-expiry',
    'weekly-plan',
    'month-by-plan',
    'shopping-by-list',
    'ten-lists',
    'receipt-accepted',
    'homemade-preserve',
    'first-recipe',
    'five-recipes',
    'author-ten',
    'big-book',
    'complete-card',
    'first-reader',
    'kitchen-tested',
    'peoples-recipe',
    'hundred-home-kitchens',
    'own-series',
    'good-advice',
    'ten-good-tips',
    'first-follower',
    'readers-circle',
    'useful-clarification',
    'catalog-helper',
    'catalog-expert',
    'allergen-noticed',
    'reliable-source',
    'good-photo',
    'first-find',
    'personal-ten',
    'big-collection',
    'favorite-authors',
    'shared-list',
    'family-dinner',
    'week-together',
    'team-kitchen',
    'seasonal-table',
    'holiday-table',
    'harvest-month',
    'early-breakfast',
    'night-cook',
    'precise-calculation',
    'everything-used',
] as const;
const condition = (
    metric: AchievementMetric,
    threshold: number,
    operator: 'gte' | 'eq' = 'gte',
): AchievementCondition => ({
    kind: 'clause',
    clause: { metric, operator, threshold },
});
const initialConditions: AchievementCondition[] = [
    condition('cookCount', 1),
    condition('cookCount', 10),
    condition('cookCount', 50),
    condition('cookCount', 100),
    condition('distinctRecipes', 10),
    condition('distinctRecipes', 25),
    condition('breakfastCount', 7),
    condition('soupCount', 5),
    condition('bakingCount', 5),
    condition('dessertCount', 5),
    condition('vegetableCount', 10),
    condition('fishCount', 5),
    condition('plantCount', 10),
    condition('cuisineCount', 5),
    condition('leftoverCount', 5),
    condition('batchCount', 1),
    condition('locatedBatchCount', 10),
    condition('activeBatchCount', 50),
    {
        kind: 'all',
        clauses: [
            { metric: 'activeBatchCount', operator: 'gte', threshold: 1 },
            { metric: 'activeInventoryDays', operator: 'gte', threshold: 7 },
            { metric: 'expiredActiveCount', operator: 'eq', threshold: 0 },
        ],
    },
    condition('maxPlanDays', 7),
    condition('planCount', 4),
    condition('shoppingCount', 1),
    condition('shoppingCount', 10),
    condition('receiptCount', 1),
    condition('preserveCount', 1),
    condition('publishedCount', 1),
    condition('publishedCount', 5),
    condition('publishedCount', 10),
    condition('publishedCount', 25),
    condition('completeRecipeCount', 1),
    condition('maxIndependentCooks', 1),
    condition('maxIndependentCooks', 5),
    condition('maxIndependentCooks', 25),
    condition('maxIndependentCooks', 100),
    condition('seriesCount', 5),
    condition('helpfulCount', 1),
    condition('helpfulCount', 10),
    condition('followerCount', 1),
    condition('followerCount', 25),
    condition('correctionCount', 1),
    condition('correctionCount', 10),
    condition('correctionCount', 50),
    condition('allergenCount', 1),
    condition('sourceCount', 5),
    condition('photoCount', 1),
    condition('bookmarkCount', 1),
    condition('bookmarkCount', 10),
    condition('bookmarkCount', 50),
    condition('followingCount', 10),
    condition('familyShoppingCount', 1),
    condition('familyCookCount', 1),
    condition('familyPlanDays', 7),
    condition('familyWeeklyCooks', 3),
    condition('seasonalCount', 5),
    condition('holidayCount', 1),
    condition('seasonalMonthCount', 10),
    condition('earlyCount', 1),
    condition('nightCount', 1),
    condition('preciseCount', 1),
    condition('everythingUsedCount', 1),
];

export function createReleaseWorkspaceState(): ReleaseWorkspace {
    let achievementIndex = 0;
    const achievements: Achievement[] = groups.flatMap(([group, entries], groupIndex) =>
        entries.map(([title], index) => {
            const ruleIndex = achievementIndex++;
            return {
                id: id(31 + groupIndex, index + 1),
                code: initialCodes[ruleIndex]!,
                title,
                description: `Публичное достижение «${title}» за вклад пользователя в Meal Planner.`,
                group,
                condition: initialConditions[ruleIndex]!,
                secret: groupIndex === 5 && index >= 3,
                icon: {
                    assetId: null,
                    fallbackKey: [
                        'food-014',
                        'medal-gold-chef',
                        'medal-silver-dialog',
                        'food-020',
                        'food-087',
                        'medal-bronze-book',
                    ][groupIndex]!,
                    alt: `Иконка достижения «${title}»`,
                },
                version: 1,
                updatedAt: now,
            };
        }),
    );
    const rankData = [
        [0, 'Новичок'],
        [25, 'Участник'],
        [75, 'Помощник'],
        [150, 'Знаток'],
        [300, 'Автор'],
        [600, 'Эксперт'],
        [1000, 'Наставник'],
        [1750, 'Мастер'],
        [3000, 'Шеф сообщества'],
        [5000, 'Легенда'],
    ] as const;
    return {
        releases: [],
        achievements,
        ranks: rankData.map(([minimum, title], index) => ({ id: id(40, index + 1), minimum, title, version: 1 })),
        legalTexts: [
            {
                key: 'privacy_policy',
                version: 1,
                content: 'Черновой текст политики конфиденциальности.',
                effectiveAt: now,
            },
            { key: 'terms_of_use', version: 1, content: 'Черновой текст условий использования.', effectiveAt: now },
        ],
        products: [
            {
                id: id(50, 1),
                name: 'Молоко пастеризованное 2,5%',
                version: 1,
                description: 'Молоко для ежедневных блюд.',
            },
            { id: id(50, 2), name: 'Овсяные хлопья', version: 1, description: 'Хлопья длительной варки.' },
        ],
        contentDocuments: [
            {
                key: 'help:ru-RU:sample-start',
                version: 1,
                retired: false,
                value: {
                    namespace: 'help',
                    locale: 'ru-RU',
                    title: 'Пример справочного материала',
                    body: 'Тестовый текст для проверки редактора контентных документов.',
                    metadata: { schemaVersion: 1, slug: 'sample-start', audience: 'all' },
                },
            },
        ],
        dictionaryEntries: [
            {
                key: 'category:sample',
                version: 1,
                retired: false,
                value: {
                    schemaVersion: 1,
                    dictionary: 'category',
                    code: 'sample',
                    label: 'Пример категории',
                    description: 'Тестовая запись для development-мока.',
                    icon: { assetId: null, fallbackKey: 'food-014', alt: 'Пример категории' },
                    sortOrder: 100,
                    enabled: true,
                },
            },
            {
                key: 'unit:sample-unit',
                version: 1,
                retired: false,
                value: {
                    schemaVersion: 1,
                    dictionary: 'unit',
                    code: 'sample-unit',
                    label: 'Пример единицы',
                    description: null,
                    icon: { assetId: null, fallbackKey: 'food-087', alt: 'Пример единицы' },
                    sortOrder: 200,
                    enabled: true,
                },
            },
            {
                key: 'allergen:sample-allergen',
                version: 1,
                retired: false,
                value: {
                    schemaVersion: 1,
                    dictionary: 'allergen',
                    code: 'sample-allergen',
                    label: 'Пример аллергена',
                    description: 'Только schema-safe placeholder, не реальные продуктовые данные.',
                    icon: { assetId: null, fallbackKey: 'food-020', alt: 'Пример аллергена' },
                    sortOrder: 300,
                    enabled: false,
                },
            },
        ],
        rollbackSnapshots: {},
        serverRevision: 1,
    };
}

export const releaseWorkspaceStateSchema = releaseWorkspaceSchema.default(createReleaseWorkspaceState);
export type ReleaseWorkspaceState = z.infer<typeof releaseWorkspaceStateSchema>;

export class ReleaseMockError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}

const event = (
    kind: 'created' | 'saved' | 'validated' | 'published' | 'rolled_back' | 'reopened',
    version: number,
    at: string,
) => ({
    id: crypto.randomUUID(),
    kind,
    version,
    at,
    actor: 'admin',
});

export function releaseWorkspaceCommand(
    state: ReleaseWorkspaceState,
    input: unknown,
    context: { critical: boolean; now: number },
): ReleaseAck {
    const command: ReleaseCommand = releaseCommandSchema.parse(input);
    const at = new Date(context.now).toISOString();
    const find = (releaseId: string) => {
        const release = state.releases.find((item) => item.id === releaseId);
        if (!release) throw new ReleaseMockError(404, 'Релиз не найден');
        return release;
    };
    let ack: ReleaseAck['ack'] = null;
    let message = '';
    if (command.action === 'create') {
        const release = releaseSchema.parse({
            id: crypto.randomUUID(),
            title: command.title,
            status: 'draft',
            version: 1,
            clientRevision: 0,
            createdAt: at,
            updatedAt: at,
            publishedAt: null,
            rolledBackAt: null,
            changes: [],
            validation: { errors: [], warnings: [], validatedVersion: null },
            events: [event('created', 1, at)],
        });
        state.releases.unshift(release);
        message = 'Черновик релиза создан';
    } else if (command.action === 'save') {
        const release = find(command.releaseId);
        if (release.status === 'published') throw new ReleaseMockError(409, 'Опубликованный релиз неизменяем');
        if (release.version !== command.baseVersion) throw new ReleaseMockError(409, 'Черновик изменён на сервере');
        release.title = command.patch.title;
        release.changes = command.patch.changes;
        release.version++;
        release.clientRevision = command.clientRevision;
        release.updatedAt = at;
        release.status = 'draft';
        release.validation = { errors: [], warnings: [], validatedVersion: null };
        release.events.push(event('saved', release.version, at));
        ack = {
            releaseId: release.id,
            baseVersion: release.version,
            clientRevision: command.clientRevision,
            checksum: command.checksum,
        };
        message = 'Черновик сохранён на сервере';
    } else if (command.action === 'validate') {
        const release = find(command.releaseId);
        if (release.version !== command.expectedVersion) throw new ReleaseMockError(409, 'Версия релиза изменилась');
        const conflicts = release.changes.flatMap((change) => {
            if (change.entityType === 'content_document') {
                const current = state.contentDocuments.find((item) => item.key === change.resourceKey);
                return (current?.version ?? 0) === change.expectedVersion
                    ? []
                    : [`Документ «${change.resourceKey}» изменился после добавления в релиз.`];
            }
            if (change.entityType === 'dictionary_entry') {
                const current = state.dictionaryEntries.find((item) => item.key === change.resourceKey);
                return (current?.version ?? 0) === change.expectedVersion
                    ? []
                    : [`Запись «${change.resourceKey}» изменилась после добавления в релиз.`];
            }
            return [];
        });
        const errors = release.changes.length ? conflicts : ['Добавьте хотя бы одно изменение.'];
        const warnings = release.changes.length > 40 ? ['В релизе больше 40 изменений — проверьте состав.'] : [];
        release.validation = { errors, warnings, validatedVersion: release.version + 1 };
        release.version++;
        release.updatedAt = at;
        release.status = errors.length ? 'draft' : 'ready';
        release.events.push(event('validated', release.version, at));
        message = errors.length ? 'Найдены ошибки' : 'Релиз готов к публикации';
    } else if (command.action === 'publish') {
        const release = find(command.releaseId);
        if (!context.critical) throw new ReleaseMockError(403, 'Требуется критичное подтверждение');
        if (release.version !== command.expectedVersion) throw new ReleaseMockError(409, 'Версия релиза изменилась');
        if (release.status !== 'ready' || release.validation.validatedVersion !== release.version)
            throw new ReleaseMockError(409, 'Сначала проверьте актуальную версию релиза');
        state.rollbackSnapshots[release.id] = {
            contentDocuments: structuredClone(state.contentDocuments),
            dictionaryEntries: structuredClone(state.dictionaryEntries),
        };
        for (const change of release.changes) {
            if (change.entityType === 'achievement') {
                const current = state.achievements.find((item) => item.id === change.entityId);
                if (change.changeType === 'retire') {
                    if (current) state.achievements.splice(state.achievements.indexOf(current), 1);
                    continue;
                }
                const next = {
                    id: change.entityId,
                    ...change.achievement,
                    version: (current?.version ?? 0) + 1,
                    updatedAt: at,
                };
                if (current) Object.assign(current, next);
                else state.achievements.push(next);
            } else if (change.entityType === 'reputation') {
                state.ranks = change.ranks.map((rank, index) => ({
                    ...rank,
                    version: (state.ranks[index]?.version ?? 0) + 1,
                }));
            } else if (change.entityType === 'legal_text') {
                const current = state.legalTexts.find((item) => item.key === change.label);
                const next = {
                    key: change.label,
                    version: (current?.version ?? 0) + 1,
                    content: change.summary,
                    effectiveAt: change.effectiveAt,
                };
                if (current) Object.assign(current, next);
                else state.legalTexts.push(next);
            } else if (change.entityType === 'product_description') {
                const current = state.products.find((item) => item.id === change.entityId);
                if (current) Object.assign(current, { description: change.summary, version: current.version + 1 });
            } else if (change.entityType === 'content_document') {
                const current = state.contentDocuments.find((item) => item.key === change.resourceKey);
                if (change.changeType === 'retire') {
                    if (current) Object.assign(current, { retired: true, version: current.version + 1 });
                } else {
                    const next = {
                        key: change.resourceKey,
                        version: (current?.version ?? 0) + 1,
                        retired: false,
                        value: structuredClone(change.document),
                    };
                    if (current) Object.assign(current, next);
                    else state.contentDocuments.push(next);
                }
            } else {
                const current = state.dictionaryEntries.find((item) => item.key === change.resourceKey);
                if (change.changeType === 'retire') {
                    if (current) Object.assign(current, { retired: true, version: current.version + 1 });
                } else {
                    const next = {
                        key: change.resourceKey,
                        version: (current?.version ?? 0) + 1,
                        retired: false,
                        value: structuredClone(change.entry),
                    };
                    if (current) Object.assign(current, next);
                    else state.dictionaryEntries.push(next);
                }
            }
        }
        release.version++;
        release.status = 'published';
        release.publishedAt = at;
        release.updatedAt = at;
        release.events.push(event('published', release.version, at));
        message = 'Релиз опубликован';
    } else if (command.action === 'rollback') {
        const release = find(command.releaseId);
        if (!context.critical) throw new ReleaseMockError(403, 'Требуется критичное подтверждение');
        if (release.version !== command.expectedVersion || release.status !== 'published')
            throw new ReleaseMockError(409, 'Опубликованная версия изменилась');
        const snapshot = state.rollbackSnapshots[release.id];
        if (snapshot) {
            state.contentDocuments = structuredClone(snapshot.contentDocuments);
            state.dictionaryEntries = structuredClone(snapshot.dictionaryEntries);
            delete state.rollbackSnapshots[release.id];
        }
        release.version++;
        release.status = 'draft';
        release.rolledBackAt = at;
        release.updatedAt = at;
        release.validation = { errors: [], warnings: [], validatedVersion: null };
        release.events.push(event('rolled_back', release.version, at));
        message = 'Релиз откачен и снова открыт как черновик';
    } else if (command.action === 'reopen') {
        const source = find(command.releaseId);
        if (source.version !== command.expectedVersion) throw new ReleaseMockError(409, 'Версия релиза изменилась');
        const copy = releaseSchema.parse({
            ...structuredClone(source),
            id: crypto.randomUUID(),
            title: `${source.title} — новая редакция`,
            status: 'draft',
            version: 1,
            clientRevision: 0,
            createdAt: at,
            updatedAt: at,
            publishedAt: null,
            rolledBackAt: null,
            validation: { errors: [], warnings: [], validatedVersion: null },
            events: [event('reopened', 1, at)],
            changes: source.changes.flatMap((change): ReleaseChange[] => {
                if (change.entityType === 'achievement') {
                    const current = state.achievements.find((item) => item.id === change.entityId);
                    if (!current) return [];
                    const achievement = {
                        code: current.code,
                        title: current.title,
                        description: current.description,
                        group: current.group,
                        condition: current.condition,
                        secret: current.secret,
                        icon: current.icon,
                    };
                    return [
                        {
                            ...change,
                            changeType: 'update' as const,
                            label: current.title,
                            expectedVersion: current.version,
                            achievement,
                        },
                    ];
                }
                if (change.entityType === 'content_document') {
                    const current = state.contentDocuments.find((item) => item.key === change.resourceKey);
                    return current && !current.retired
                        ? [
                              {
                                  ...change,
                                  changeType: 'update' as const,
                                  label: current.value.title,
                                  expectedVersion: current.version,
                                  document: structuredClone(current.value),
                              },
                          ]
                        : [];
                }
                if (change.entityType === 'dictionary_entry') {
                    const current = state.dictionaryEntries.find((item) => item.key === change.resourceKey);
                    return current && !current.retired
                        ? [
                              {
                                  ...change,
                                  changeType: 'update' as const,
                                  label: current.value.label,
                                  expectedVersion: current.version,
                                  entry: structuredClone(current.value),
                              },
                          ]
                        : [];
                }
                return [change];
            }),
        });
        state.releases.unshift(copy);
        message = 'Создан новый черновик из актуальных данных';
    }
    state.serverRevision++;
    return { workspace: structuredClone(state), ack, message };
}
