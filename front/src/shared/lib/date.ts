export function localDate(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function dateText(value: string | null) {
    return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU') : 'Не указана';
}
