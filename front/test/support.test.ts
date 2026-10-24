import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeed } from '../src/mocks/model.js';
import { supportHandle } from '../src/mocks/support.js';
import { contracts } from '../src/shared/api/contracts.generated.js';

const user1 = '10000000-0000-4000-8000-000000000007';
const user2 = '10000000-0000-4000-8000-000000000008';
const requestId = '62000000-0000-4000-8000-000000000099';

function request(
    state: ReturnType<typeof createSeed>,
    userId: string | null,
    path: string,
    method = 'GET',
    input: unknown = undefined,
) {
    const ids = path.match(/[0-9a-f-]{36}/gu) ?? [];
    return supportHandle({
        state,
        userId,
        path,
        params: ids[0] ? { id: ids[0], ...(ids[1] ? { messageId: ids[1] } : {}) } : {},
        method,
        query: new URLSearchParams(),
        input,
        now: Date.parse('2026-10-14T00:00:00.000Z'),
        success: (data) => Response.json({ data, meta: { requestId } }),
        fail: (status) => Response.json({ error: { code: 'TEST', message: 'Test failure' } }, { status }),
    })!;
}

void test('support create, detail and reply expose the strict public detail without internal userId', async () => {
    const state = createSeed();
    const createdResponse = request(state, user1, '/api/v1/support', 'POST', {
        category: 'general',
        subject: 'Проверка обращения',
        body: 'Первое сообщение.',
        attachments: [],
        idempotencyKey: '62000000-0000-4000-8000-000000000001',
    });
    assert.equal(createdResponse.status, 200);
    const created = contracts['POST /api/v1/support'].success.parse(await createdResponse.json()).data;
    assert.equal(Object.hasOwn(created, 'userId'), false);
    const replayedResponse = request(state, user1, '/api/v1/support', 'POST', {
        category: 'general',
        subject: 'Проверка обращения',
        body: 'Первое сообщение.',
        attachments: [],
        idempotencyKey: '62000000-0000-4000-8000-000000000001',
    });
    assert.equal(replayedResponse.status, 200);
    const replayed = contracts['POST /api/v1/support'].success.parse(await replayedResponse.json()).data;
    assert.equal(replayed.ticket.id, created.ticket.id);
    assert.equal(state.support.tickets.filter((value) => value.ticket.id === created.ticket.id).length, 1);
    assert.equal(
        request(state, user1, '/api/v1/support', 'POST', {
            category: 'general',
            subject: 'Другой payload с тем же ключом',
            body: 'Конфликт replay.',
            attachments: [],
            idempotencyKey: '62000000-0000-4000-8000-000000000001',
        }).status,
        409,
    );

    const detailPath = `/api/v1/support/${created.ticket.id}`;
    const detailResponse = request(state, user1, detailPath);
    assert.equal(detailResponse.status, 200);
    const detail = contracts['GET /api/v1/support/{id}'].success.parse(await detailResponse.json()).data;
    assert.equal(Object.hasOwn(detail, 'userId'), false);
    assert.equal(request(state, user2, detailPath).status, 404);

    const replyResponse = request(state, user1, `${detailPath}/reply`, 'POST', {
        body: 'Ответ владельца.',
        attachments: [],
        expectedVersion: detail.ticket.version,
        idempotencyKey: '62000000-0000-4000-8000-000000000002',
    });
    assert.equal(replyResponse.status, 200);
    const replied = contracts['POST /api/v1/support/{id}/reply'].success.parse(await replyResponse.json()).data;
    assert.equal(Object.hasOwn(replied, 'userId'), false);
    assert.equal(replied.messages.at(-1)?.body, 'Ответ владельца.');
});

void test('closed support tickets reject replies and edits until they are reopened', () => {
    const state = createSeed();
    request(state, user1, '/api/v1/support');
    const closed = state.support.tickets.find((value) => value.userId === user1 && value.ticket.status === 'closed')!;
    const path = `/api/v1/support/${closed.ticket.id}`;
    assert.equal(
        request(state, user1, `${path}/reply`, 'POST', {
            body: 'Нельзя добавить в закрытое обращение.',
            attachments: [],
            expectedVersion: closed.ticket.version,
            idempotencyKey: '62000000-0000-4000-8000-000000000003',
        }).status,
        409,
    );
    assert.equal(
        request(state, user1, `${path}/messages/${closed.messages[0]!.id}`, 'PATCH', {
            body: 'Нельзя изменить закрытое обращение.',
            messageVersion: closed.messages[0]!.version,
            expectedVersion: closed.ticket.version,
            idempotencyKey: '62000000-0000-4000-8000-000000000004',
        }).status,
        409,
    );
});
