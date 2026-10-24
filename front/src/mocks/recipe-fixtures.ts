import { contracts, type Success } from '../shared/api/contracts.generated.js';
export type RecipeFixture = Success<'GET /api/v1/recipes/{id}'>['data']['recipe'];
const uuid = (kind: number, index: number) => `${kind}0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
export const recipeProductFixtures = [
    ['4', 'Паста', 'g'],
    ['5', 'Помидоры черри', 'g'],
    ['6', 'Базилик', 'g'],
    ['7', 'Оливковое масло', 'ml'],
    ['8', 'Пармезан', 'g'],
    ['9', 'Тыква', 'g'],
    ['10', 'Лосось', 'g'],
    ['11', 'Огурцы', 'g'],
    ['12', 'Овсяные хлопья', 'g'],
] as const;
const ingredientNames: Record<string, string> = {
    '1': 'Молоко',
    '2': 'Яблоки',
    '3': 'Рис',
    ...Object.fromEntries(recipeProductFixtures.map(([id, name]) => [id, name])),
};
const entry = (recipe: number, product: number, quantity: string | null, unit = 'g', optional = false) => ({
    id: uuid(8, recipe * 100 + product),
    position: product,
    name: ingredientNames[String(product)]!,
    ingredientId: uuid(1, product),
    variantId: null,
    productId: null,
    sourceRecipeId: null,
    quantity,
    unit,
    optional,
});
const allergenIcon = (code: string, name: string) => ({
    state: 'fallback' as const,
    url: `/assets/allergens/${code === 'tree_nuts' ? 'tree-nuts' : code}.png`,
    fallbackKey: `allergen-${code}`,
    alt: `Пиктограмма: ${name}`,
});
const allergenIngredient = (item: ReturnType<typeof entry>) => ({
    recipeIngredientId: item.id,
    name: item.name,
    ingredientId: item.ingredientId,
    variantId: item.variantId,
    productId: item.productId,
});
// Only published, non-personal projections belong here: the server uses these fixtures in development SSR.
export function publicRecipeFixtures(): RecipeFixture[] {
    const definitions = [
        {
            title: 'Паста с томатами и базиликом',
            description: 'Простое итальянское счастье в тарелке',
            category: 'mains',
            image: '/assets/food-160.webp',
            minutes: 25,
            ingredients: [
                entry(1, 4, '320'),
                entry(1, 5, '500'),
                entry(1, 6, '30'),
                entry(1, 7, '30', 'ml'),
                entry(1, 8, '60', 'g', true),
            ],
        },
        {
            title: 'Запечённый лосось с овощами',
            description: 'Нежное филе с сезонными овощами и пряными травами',
            category: 'mains',
            image: '/recipes/food-159.png',
            minutes: 40,
            ingredients: [entry(2, 10, '600'), entry(2, 5, '300'), entry(2, 7, '20', 'ml')],
        },
        {
            title: 'Тыквенный суп-пюре',
            description: 'Тёплый и нежный суп для уютного обеда',
            category: 'soups',
            image: '/assets/food-161.webp',
            minutes: 35,
            ingredients: [entry(3, 9, '700'), entry(3, 1, '200', 'ml'), entry(3, 7, '20', 'ml')],
        },
        {
            title: 'Греческий салат',
            description: 'Хрустящие овощи и свежая зелень',
            category: 'salads',
            image: '/assets/food-162.webp',
            minutes: 15,
            ingredients: [
                entry(4, 5, '400'),
                entry(4, 11, '300'),
                entry(4, 7, '30', 'ml'),
                entry(4, 6, null, 'g', true),
            ],
        },
        {
            title: 'Овсяные панкейки с ягодами',
            description: 'Спокойное начало дня за общим столом',
            category: 'breakfast',
            image: '/recipes/food-163.png',
            minutes: 20,
            ingredients: [entry(5, 12, '200'), entry(5, 1, '300', 'ml')],
        },
        {
            title: 'Рисовая каша с яблоками',
            description: 'Простой завтрак из ваших запасов',
            category: 'breakfast',
            image: null,
            minutes: 30,
            ingredients: [entry(6, 3, '160'), entry(6, 1, '500', 'ml'), entry(6, 2, '2', 'pcs')],
        },
        {
            title: 'Паста с томатами без сыра',
            description: 'Вариант базового рецепта без молочных продуктов',
            category: 'mains',
            image: '/assets/food-160.webp',
            minutes: 25,
            ingredients: [entry(7, 4, '320'), entry(7, 5, '500'), entry(7, 6, '30'), entry(7, 7, '30', 'ml')],
        },
    ];
    const recipes: RecipeFixture[] = definitions.map((d, i) => ({
        id: uuid(7, i + 1),
        revisionId: uuid(6, i + 1),
        title: d.title,
        description: d.description,
        imageUrl: d.image,
        tags:
            i === 0
                ? ['Итальянская кухня', 'Быстро', 'balanced']
                : i === 2
                  ? ['vegetarian', 'balanced']
                  : i === 3
                    ? ['vegetarian', 'mediterranean', 'balanced']
                    : i === 5
                      ? ['vegetarian', 'balanced']
                      : ['balanced'],
        category: d.category,
        authorLogin: i % 2 === 0 ? 'user1' : 'user2',
        baseServings: 4,
        durationMinutes: d.minutes,
        rating: i === 5 ? null : [4.8, 4.7, 4.6, 4.5, 4.7, 4.8, 4.4][i]!,
        ratingCount: i === 5 ? 0 : [124, 87, 89, 203, 176, 0, 12][i]!,
        publishedAt: `2026-09-${String(20 + i).padStart(2, '0')}T09:00:00.000Z`,
        availability: null,
        method: i === 1 ? 'oven' : 'stovetop',
        ingredients: d.ingredients,
        nutrition: i === 0 ? { kcal: '520', protein: '18', fat: '20', carbs: '68', basis: 'serving' } : null,
        allergens:
            i === 0
                ? [
                      {
                          code: 'gluten',
                          name: 'Глютен',
                          status: 'contains' as const,
                          source: 'Словарь ингредиентов',
                          icon: allergenIcon('gluten', 'Глютен'),
                          ingredients: [allergenIngredient(d.ingredients[0]!)],
                          evidence: [{ kind: 'dictionary' as const, source: 'Паста', mappingId: null }],
                      },
                      {
                          code: 'milk',
                          name: 'Молоко',
                          status: 'contains' as const,
                          source: 'Словарь ингредиентов',
                          icon: allergenIcon('milk', 'Молоко'),
                          ingredients: [allergenIngredient(d.ingredients[4]!)],
                          evidence: [{ kind: 'dictionary' as const, source: 'Пармезан', mappingId: null }],
                      },
                      {
                          code: 'tree_nuts',
                          name: 'Орехи',
                          status: 'may_contain' as const,
                          source: 'Данные поставщика',
                          icon: allergenIcon('tree_nuts', 'Орехи'),
                          ingredients: [allergenIngredient(d.ingredients[2]!)],
                          evidence: [{ kind: 'composition' as const, source: 'Базилик', mappingId: null }],
                      },
                  ]
                : [],
        allergensComplete: false,
        allergenCompleteness: {
            complete: false,
            unknownIngredients: (i === 0 ? [d.ingredients[1]!, d.ingredients[3]!] : d.ingredients).map(
                allergenIngredient,
            ),
        },
        steps: (i === 0 || i === 6
            ? [
                  'Подготовьте и промойте томаты и базилик.',
                  'Отварите пасту по инструкции на упаковке.',
                  'Разогрейте масло и прогрейте нарезанные томаты.',
                  'Добавьте пасту к томатам и перемешайте.',
                  'Добавьте базилик и подавайте блюдо горячим.',
              ]
            : [
                  'Подготовьте ингредиенты и отмерьте нужное количество.',
                  'Приготовьте ингредиенты выбранным способом до готовности.',
                  'Разложите по порциям и подавайте.',
              ]
        ).map((text, index) => ({
            id: uuid(9, (i + 1) * 100 + index),
            position: index + 1,
            text,
            durationSeconds: index === 1 ? 600 : null,
            temperature: i === 1 && index === 1 ? '180' : null,
        })),
        variants: [],
        comments:
            i === 0
                ? [
                      {
                          id: uuid(5, 1),
                          body: 'Простой рецепт, удобно пересчитывать порции. Базилик добавляю в самом конце.',
                          authorLogin: 'user2',
                          createdAt: '2026-09-27T10:00:00.000Z',
                          edited: false,
                          replyToId: null,
                      },
                  ]
                : [],
        commentsTotal: i === 0 ? 1 : 0,
    }));
    const variant = recipes[6]!;
    recipes[0]!.variants = [recipeSummary(variant)];
    // Additional distinct demonstration entries exercise the second catalogue page.
    const additional = recipes.slice(0, 6).map((recipe, index) => ({
        ...recipe,
        id: uuid(7, index + 8),
        revisionId: uuid(6, index + 8),
        title: 'Домашний вариант: ' + recipe.title,
        publishedAt: '2026-09-19T09:00:00.000Z',
        ingredients: recipe.ingredients.map((line, position) => ({
            ...line,
            id: uuid(8, (index + 8) * 100 + position),
        })),
        steps: recipe.steps.map((step, position) => ({ ...step, id: uuid(9, (index + 8) * 100 + position) })),
        rating: null,
        ratingCount: 0,
        variants: [],
        comments: [],
        commentsTotal: 0,
    }));
    return [...recipes, ...additional];
}

export function recipeSummary(recipe: RecipeFixture) {
    const schema = contracts['GET /api/v1/recipes'].success.shape.data.shape.items.element;
    return schema.parse(Object.fromEntries(Object.keys(schema.shape).map((key) => [key, Reflect.get(recipe, key)])));
}
