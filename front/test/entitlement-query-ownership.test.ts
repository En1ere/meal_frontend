import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { entitlementKeys as publicEntitlementKeys } from '../src/entities/entitlement/model.js';
import { entitlementKeys } from '../src/entities/entitlement/query-keys.js';

void test('entitlement entity preserves the exact account-scoped tuple and public identity', () => {
    assert.equal(publicEntitlementKeys, entitlementKeys);
    assert.deepEqual(entitlementKeys.forAccount(undefined), ['entitlements', undefined]);
    assert.deepEqual(entitlementKeys.forAccount('user-a'), ['entitlements', 'user-a']);
});

void test('planning and receipt consumers share the entitlement owner without changing transports or gates', async () => {
    const [mealPlan, mealPlanAdapter, receiptNew] = await Promise.all([
        readFile('src/features/meal-plan/page.tsx', 'utf8'),
        readFile('src/features/meal-plan/api.ts', 'utf8'),
        readFile('src/features/shopping/receipts/new-page.tsx', 'utf8'),
    ]);
    const sources = [mealPlan, receiptNew];

    assert.equal(
        sources.flatMap((source) => source.match(/entitlementKeys\.forAccount\(user\.data\?\.id\)/gu) ?? []).length,
        2,
    );
    for (const source of sources) {
        assert.doesNotMatch(source, /\[['"]entitlements['"],\s*user\.data\?\.id\]/u);
        assert.match(source, /enabled: !!api && !!user\.data/u);
    }
    assert.match(mealPlan, /queryFn: \(\{ signal \}\) => loadMealPlanEntitlements\(api!, signal\)/u);
    assert.match(mealPlanAdapter, /'GET \/api\/v1\/entitlements'/u);
    assert.match(receiptNew, /queryFn: \(\{ signal \}\) => loadShoppingEntitlements\(api!, signal\)/u);

    assert.match(mealPlan, /from ['"]\.\.\/\.\.\/entities\/entitlement\/model\.js['"]/u);
    assert.match(mealPlan, /capabilities\.planningRange === true/u);
    assert.match(mealPlan, /capabilities\.smartShopping === true/u);
    assert.match(mealPlan, /capabilities\.calendar === true/u);
    assert.match(mealPlan, /previewMealPlanChange\(api, \{/u);
    assert.match(mealPlan, /commitMealPlanChange\(api, \{/u);

    assert.match(receiptNew, /from ['"]\.\.\/\.\.\/\.\.\/entities\/entitlement\/model\.js['"]/u);
    assert.match(receiptNew, /queryKey: shoppingKeys\.receiptCapabilities/u);
    assert.match(receiptNew, /const pro = entitlement\.data\?\.plan === ['"]pro['"]/u);
    assert.match(receiptNew, /sourceKind === ['"]electronic_link['"] \|\| financeEnabled/u);
    assert.match(receiptNew, /cmd\.run\(['"]POST \/api\/v1\/receipts['"]/u);
});
