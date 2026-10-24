import {
    operationsCommandSchema,
    operationsResultSchema,
    type OperationsResult,
    type Operation,
} from '../features/operations/contracts.js';
import type { AdminState, AdminRow } from './admin-model.js';
export class OperationsMockError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
export function operationsWorkspaceCommand(
    state: AdminState,
    input: unknown,
    context: { actorId: string; critical: boolean; now: number },
): OperationsResult {
    const parsed = operationsCommandSchema.safeParse(input);
    if (!parsed.success) throw new OperationsMockError(400, 'Проверьте поля команды.');
    const command = parsed.data;
    const source = state.tables[command.section === 'operations' ? 'background_jobs' : 'admin_error_events']?.find(
        (row) => row.id === command.id,
    );
    if (!source) throw new OperationsMockError(404, 'Запись не найдена.');
    // Lifecycle metadata lives separately; original sanitized error event remains append-only.
    const incident = state.tables.admin_incident_states?.find((row) => row.id === command.id);
    const row =
        command.section === 'errors'
            ? (incident ?? { id: command.id, version: '1', status: 'new', occurrences: 1 })
            : source;
    const version = String(row.version ?? '1');
    const status =
        row.status === 'ignored' &&
        typeof row.ignored_until === 'string' &&
        Date.parse(row.ignored_until) <= context.now
            ? 'new'
            : String(row.status);
    const kind = String(source.kind ?? source.code ?? 'unknown');
    const allowed: OperationsResult['allowed'] =
        command.section === 'errors'
            ? (['new', 'in_progress', 'resolved', 'ignored'] as const).map((operation) => ({
                  operation,
                  enabled: true,
                  reason: '',
              }))
            : [
                  {
                      operation: 'retry',
                      enabled: kind === 'recipe_import' && ['failed', 'dead_letter'].includes(status),
                      reason:
                          kind !== 'recipe_import'
                              ? 'Для этого обработчика безопасный повтор ещё не поддержан. Неизвестный финансовый исход сначала сверяется.'
                              : 'Повтор доступен только для неудавшегося импорта.',
                  },
                  {
                      operation: 'cancel',
                      enabled: kind === 'recipe_import' && ['pending', 'queued'].includes(status),
                      reason:
                          status === 'running'
                              ? 'Обработчик не поддерживает безопасную остановку выполняющейся задачи.'
                              : 'Отмена доступна только для ожидающего импорта. Завершённое действие требует компенсации.',
                  },
              ];
    const result: OperationsResult = {
        id: command.id,
        version,
        status,
        kind,
        failure:
            command.section === 'errors'
                ? String(source.message ?? 'Нет безопасного описания')
                : 'Подробности сбоя доступны в связанном журнале ошибок.',
        allowed,
        preview: null,
        message: '',
    };
    if (command.action === 'inspect') return result;
    const digest = JSON.stringify(command);
    const log = state.tables.operations_commands ?? [];
    const previous = log.find((entry) => entry.id === command.idempotencyKey && entry.actor_id === context.actorId);
    if (previous && command.action === 'execute') {
        if (previous.digest !== digest) throw new OperationsMockError(409, 'Ключ уже использован для другой команды.');
        return operationsResultSchema.parse(JSON.parse(String(previous.result)));
    }
    if (version !== command.expectedVersion)
        throw new OperationsMockError(409, 'Состояние изменилось. Обновите предпросмотр.');
    if (!allowed.find((entry) => entry.operation === command.operation)?.enabled)
        throw new OperationsMockError(409, 'Действие недоступно для текущего состояния.');
    if (!command.reason) throw new OperationsMockError(400, 'Укажите причину.');
    if (command.operation === 'ignored' && (!command.ignoreUntil || Date.parse(command.ignoreUntil) <= context.now))
        throw new OperationsMockError(400, 'Укажите будущую дату окончания игнорирования.');
    const descriptions: Record<Operation, string> = {
        retry: 'Импорт будет повторно поставлен в очередь. Результат импорта не гарантируется.',
        cancel: 'Ожидающий импорт будет отменён. Уже выполненные действия не откатываются.',
        new: 'Инцидент вернётся в новые. События и история сохранятся.',
        in_progress: 'Инцидент отмечается как взятый в работу.',
        resolved: 'Инцидент отмечается решённым. Это не подтверждение исправления кода.',
        ignored: 'Инцидент игнорируется до указанного срока. Сбор событий продолжается.',
    };
    const critical = /payment|refund|campaign|broadcast/.test(kind);
    result.preview = { summary: descriptions[command.operation], critical };
    if (command.action === 'preview') return result;
    if (critical && !context.critical) throw new OperationsMockError(403, 'Требуется критичное подтверждение.');
    if (command.section === 'errors') {
        row.status = command.operation;
        row.ignored_until = command.operation === 'ignored' ? command.ignoreUntil : null;
        if (!incident) (state.tables.admin_incident_states ??= []).push(row);
    } else {
        row.status = command.operation === 'retry' ? 'queued' : 'cancelled';
        if (command.operation === 'retry') row.run_at = new Date(context.now).toISOString();
    }
    row.version = String(Number(version) + 1);
    const audit: AdminRow = {
        id: crypto.randomUUID(),
        created_at: new Date(context.now).toISOString(),
        actor_id: context.actorId,
        action: `operations.${command.operation}`,
        target_id: command.id,
        reason: command.reason,
        version: row.version,
    };
    (state.tables.audit_events ??= []).push(audit);
    result.version = String(row.version);
    result.status = String(row.status);
    result.preview = null;
    result.message = 'Изменение сохранено в демонстрационном состоянии. Реальная задача не запускалась.';
    (state.tables.operations_commands ??= []).push({
        id: command.idempotencyKey,
        actor_id: context.actorId,
        digest,
        result: JSON.stringify(result),
    });
    return result;
}
