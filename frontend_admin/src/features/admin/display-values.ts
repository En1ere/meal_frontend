interface DisplayField {
    key: string;
    label: string;
    value: string | null;
}

const statusLabels: Readonly<Record<string, string>> = {
    active: 'Действует',
    revoked: 'Отозвано',
    expired: 'Истекло',
    open: 'Открыто',
    closed: 'Закрыто',
    waiting_for_support: 'Ожидает поддержки',
    waiting_for_user: 'Ожидает пользователя',
    queued: 'В очереди',
    in_review: 'На рассмотрении',
    completed: 'Завершено',
    processing: 'В обработке',
    retrying: 'Повторная обработка',
    dead_letter: 'Требует проверки',
    failed: 'Ошибка',
    pending: 'Ожидает',
    draft: 'Черновик',
    published: 'Опубликовано',
    approved: 'Одобрено',
    rejected: 'Отклонено',
    available: 'Доступно',
    unknown: 'Неизвестно',
    blocked: 'Заблокировано',
    running: 'Выполняется',
    succeeded: 'Успешно',
    cancelled: 'Отменено',
};

export function displayStatus(status: string | null): string {
    if (status === null) return 'Статус не указан';
    return Object.hasOwn(statusLabels, status) ? statusLabels[status]! : status;
}

// Currency must come from this record. A related payment attempt without its
// own currency stays in minor units; the parent order is not a safe fallback.
export function displayField(field: DisplayField, fields: readonly DisplayField[]): { label: string; value: string } {
    const { key, label, value } = field;
    if (value === null) return { label, value: 'Нет данных' };
    if (key === 'amount_minor' && fields.find((entry) => entry.key === 'currency')?.value === 'RUB') {
        if (/^-?\d+$/.test(value) && Number.isSafeInteger(Number(value))) {
            const minor = BigInt(value);
            const absolute = minor < 0n ? -minor : minor;
            return {
                label: 'Сумма',
                value: `${minor < 0n ? '-' : ''}${absolute / 100n},${String(absolute % 100n).padStart(2, '0')} ₽`,
            };
        }
    }
    if (key === 'auto_renew' && (value === 'true' || value === 'false')) {
        return { label, value: value === 'true' ? 'Да' : 'Нет' };
    }
    if (key === 'status' || key === 'latestPaymentStatus') return { label, value: displayStatus(value) };
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(value) && Number.isFinite(Date.parse(value))) {
        return { label, value: new Date(value).toLocaleString() };
    }
    return { label, value };
}
