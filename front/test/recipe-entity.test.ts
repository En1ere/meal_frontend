import test from 'node:test';
import assert from 'node:assert/strict';
import {
    categoryLabels,
    isRecipeImageSourceAllowed,
    methodLabels,
    recipeRatingText,
    recipeUnits,
} from '../src/entities/recipe/model.js';

void test('recipe entity preserves safe image sources and localized rating text', () => {
    assert.equal(isRecipeImageSourceAllowed('/assets/recipe.webp'), true);
    assert.equal(isRecipeImageSourceAllowed('https://cdn.example.test/recipe.webp'), true);
    for (const source of [
        null,
        '',
        '//cdn.example.test/recipe.webp',
        'http://cdn.example.test/recipe.webp',
        'data:image/png',
    ])
        assert.equal(isRecipeImageSourceAllowed(source), false);
    assert.equal(recipeRatingText(null, 4), 'Пока нет оценок');
    assert.equal(recipeRatingText(4.25, 0), 'Пока нет оценок');
    assert.equal(recipeRatingText(4.25, 3), '★ 4,3 (3)');
});

void test('recipe entity keeps the complete wire-code dictionaries', () => {
    assert.deepEqual(recipeUnits, { g: 'г', kg: 'кг', ml: 'мл', l: 'л', pcs: 'шт.', pack: 'уп.', serv: 'порц.' });
    assert.deepEqual(categoryLabels, {
        breakfast: 'Завтраки',
        soups: 'Супы',
        mains: 'Основные блюда',
        salads: 'Салаты',
        baking: 'Выпечка',
        desserts: 'Десерты',
        snacks: 'Закуски',
        sauces: 'Соусы',
    });
    assert.deepEqual(methodLabels, {
        stovetop: 'На плите',
        oven: 'В духовке',
        baking: 'Выпекание',
        boiling: 'Варка',
        frying: 'Жарка',
        steaming: 'На пару',
        raw: 'Без нагрева',
        no_cook: 'Без нагрева',
        grill: 'На гриле',
    });
});
