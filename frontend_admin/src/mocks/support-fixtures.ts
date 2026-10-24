import type { MockState } from './model.js';
// Metadata fixtures only. No uploaded bytes, public URLs or real scanner outcomes.
export function seedSupportWorkspace(state: MockState, ticketId: string) {
    const tables = state.admin.tables;
    if ((tables.support_fixture_markers ??= []).some((r) => r.id === ticketId)) return;
    tables.support_fixture_markers.push({ id: ticketId });
    const ticket = tables.support_tickets?.find((t) => t.id === ticketId);
    const staff = state.users.find((u) => u.role === 'admin');
    if (!ticket || !staff) return;
    const stamp = '2026-09-28T08:00:00.000Z';
    const messageId = crypto.randomUUID();
    (tables.support_messages ??= []).push(
        {
            id: messageId,
            ticket_id: ticketId,
            author_id: String(ticket.requester_id),
            body: 'После обновления план появился, но один рецепт всё ещё отсутствует.',
            internal: false,
            created_at: stamp,
            version: '2',
        },
        {
            id: crypto.randomUUID(),
            ticket_id: ticketId,
            author_id: staff.id,
            body: 'Проверить синхронизацию семейного плана. Внутренняя заметка, пользователю не показывается.',
            internal: true,
            created_at: stamp,
            version: '1',
        },
    );
    (tables.support_message_revisions ??= []).push({
        id: crypto.randomUUID(),
        message_id: messageId,
        body: 'Семейный план полностью отсутствует.',
        created_at: stamp,
        author_id: String(ticket.requester_id),
    });
    for (const [name, type, status, reason] of [
        ['screen.mp4', 'video/mp4', 'pending', 'Мок: ожидает проверки сканером'],
        ['screenshot.png', 'image/png', 'ready', 'Демонстрация статуса. Реальный файл отсутствует'],
        ['document.pdf', 'application/pdf', 'rejected', 'Тестовый отказ проверки файла'],
        ['hidden.jpg', 'image/jpeg', 'hidden', 'Сотрудник скрыл тестовое вложение'],
    ] as const)
        (tables.support_attachments ??= []).push({
            id: crypto.randomUUID(),
            ticket_id: ticketId,
            message_id: messageId,
            name,
            type,
            status,
            reason,
            size: 2048,
            duration: type === 'video/mp4' ? 8 : null,
            created_at: stamp,
            version: '1',
        });
}
