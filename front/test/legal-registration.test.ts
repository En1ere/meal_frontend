import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MockApi } from '../src/mocks/api.js';
import { mockLegalManifest } from '../src/mocks/legal.js';
import { MemoryRepository } from '../src/mocks/repository.js';

const origin = 'http://localhost:3000';

function registrationInput() {
    const offer = mockLegalManifest.documents.find((item) => item.kind === 'offer')!;
    const privacy = mockLegalManifest.documents.find((item) => item.kind === 'privacy_notice')!;
    return {
        username: 'legal_test_user',
        displayName: 'Legal test user',
        email: 'legal-test-user@example.test',
        password: 'Valid-password-1',
        legal: {
            offerAcceptance: { accepted: true as const, document: offer.document },
            privacyAcknowledgement: { acknowledged: true as const, document: privacy.document },
        },
    };
}

async function csrf(api: MockApi) {
    const response = await api.handle(new Request(`${origin}/api/v1/auth/csrf`));
    const body = (await response.json()) as { data: { token: string } };
    const cookie = response.headers.getSetCookie()[0]!.split(';')[0]!;
    return { token: body.data.token, cookie };
}

async function register(
    api: MockApi,
    input: ReturnType<typeof registrationInput>,
    auth: Awaited<ReturnType<typeof csrf>>,
) {
    return api.handle(
        new Request(`${origin}/api/v1/auth/register/v2`, {
            method: 'POST',
            headers: {
                origin,
                cookie: auth.cookie,
                'content-type': 'application/json',
                'x-csrf-token': auth.token,
            },
            body: JSON.stringify(input),
        }),
    );
}

void test('registration mock rejects stale legal evidence without creating account or mail', async () => {
    const repository = new MemoryRepository();
    const api = new MockApi(repository, { origin, rateLimit: 100 });
    const auth = await csrf(api);
    const input = registrationInput();
    input.legal.offerAcceptance.document = {
        ...input.legal.offerAcceptance.document,
        documentVersion: input.legal.offerAcceptance.document.documentVersion + 1,
    };

    const response = await register(api, input, auth);
    assert.equal(response.status, 409);
    assert.equal(((await response.json()) as { error: { code: string } }).error.code, 'LEGAL_DOCUMENT_STALE');
    await repository.transaction((state) => {
        assert.equal(
            state.users.some((user) => user.email === input.email),
            false,
        );
        assert.equal(
            state.account.mail.some((message) => message.email === input.email),
            false,
        );
    });
});

void test('registration remains atomic when mail runtime is unavailable and succeeds after recovery', async () => {
    let ready = true;
    const repository = new MemoryRepository();
    const api = new MockApi(repository, { origin, ready: () => ready, rateLimit: 100 });
    const auth = await csrf(api);
    const input = registrationInput();
    ready = false;

    assert.equal((await register(api, input, auth)).status, 503);
    await repository.transaction((state) => {
        assert.equal(
            state.users.some((user) => user.email === input.email),
            false,
        );
        assert.equal(
            state.account.mail.some((message) => message.email === input.email),
            false,
        );
    });

    ready = true;
    assert.equal((await register(api, input, auth)).status, 200);
    await repository.transaction((state) => {
        assert.equal(state.users.filter((user) => user.email === input.email).length, 1);
        assert.equal(state.account.mail.filter((message) => message.email === input.email).length, 1);
    });
});
