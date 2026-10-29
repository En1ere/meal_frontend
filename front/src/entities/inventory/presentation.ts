import { localDate } from '../../shared/lib/date.js';

export function expiryText(value: string | null, now = new Date()) {
    if (!value) return 'Срок не указан';
    const days = Math.round((Date.parse(value) - Date.parse(localDate(now))) / 86400000);
    return days < 0 ? 'Срок истёк' : days === 0 ? 'Истекает сегодня' : `Через ${days} дн.`;
}
