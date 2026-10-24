import type { MockState } from './model.js';
export function seedGovernanceFixtures(state: MockState) {
    const table = (state.admin.tables.sanctions ??= []);
    const appeals = (state.admin.tables.appeals ??= []);
    const appealId = '73000000-0000-4000-8000-000000000001';
    if (table[0] && !appeals.some((a) => a.id === appealId))
        appeals.push({
            id: appealId,
            sanction_id: table[0].id!,
            user_id: table[0].user_id!,
            body: 'Прошу пересмотреть ограничение: считаю решение ошибочным.',
            status: 'pending',
            response: null,
            resolved_at: null,
            submitted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            version: '1',
        });
    if (table.some((r) => r.fixture_kind === 'governance')) return;
    const user = state.users.find((u) => u.role === null);
    if (!user) return;
    const now = Date.now();
    for (const [index, status] of ['scheduled', 'expired', 'revoked', 'active'].entries())
        table.push({
            id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            fixture_kind: 'governance',
            user_id: user.id,
            scope: ['publications', 'ai', 'comments', 'comments'][index]!,
            category: 'rules',
            reason: 'Тестовый пример: нарушение правил использования сервиса',
            private_note: 'Учебная запись, не реальный пользователь',
            starts_at: new Date(now + (status === 'scheduled' ? 86400000 : -86400000)).toISOString(),
            ends_at: status === 'expired' ? new Date(now - 1000).toISOString() : null,
            revoked_at: status === 'revoked' ? new Date(now - 1000).toISOString() : null,
            created_at: new Date(now).toISOString(),
            version: '1',
        });
}
