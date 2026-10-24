import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockApi } from '../src/mocks/api.js';
import { MemoryRepository } from '../src/mocks/repository.js';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { profileText, recipeCountText, profileFallbacks } from '../src/features/profiles/fallbacks.js';

await test('public profile never contains private name/email and hides inactive accounts', async () => {
    const store = new MemoryRepository();
    const api = new MockApi(store, { origin: 'http://localhost:3000' });
    const get = (path: string) => api.handle(new Request('http://localhost:3000' + path));
    const response = await get('/api/v1/authors/user1');
    assert.equal(response.status, 200);
    const { data } = contracts['GET /api/v1/authors/{username}'].success.parse(await response.json());
    assert.deepEqual(data.profile, {
        username: 'user1',
        avatarUrl: null,
        recipeCount: 7,
        reputationLabel: null,
        achievements: null,
    });
    assert.equal((await get('/api/v1/profile')).status, 401);
    assert.equal((await get('/api/v1/authors/missing')).status, 404);
    await store.transaction((state) => {
        state.users.find((user) => user.login === 'user1')!.active = false;
    });
    assert.equal((await get('/api/v1/authors/user1')).status, 404);
});
await test('profile fallbacks distinguish absent data, zero and explicit values', () => {
    assert.equal(profileText('   ', profileFallbacks.username), 'Автор');
    assert.equal(profileText(null, profileFallbacks.email), 'Email недоступен');
    assert.equal(profileText(' user1 ', profileFallbacks.username), 'user1');
    assert.equal(recipeCountText(null), profileFallbacks.recipeCount);
    assert.equal(recipeCountText(0), 'Опубликованных рецептов: 0');
});
