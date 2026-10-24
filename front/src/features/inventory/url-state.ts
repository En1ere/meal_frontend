const dateValue = (value: string | null) =>
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
        ? value
        : '';
export function historyView(query: URLSearchParams, prefix = '') {
    const value = (name: string) => query.get(prefix + name);
    const offset = Number(value('offset') ?? 0);
    return {
        q: (value('q') ?? '').slice(0, 200),
        action: value('action') ?? '',
        from: dateValue(value('from')),
        to: dateValue(value('to')),
        offset: Number.isInteger(offset) && offset >= 0 && offset <= 100000 ? offset : 0,
        selected: value('event'),
    };
}
export function historyViewUrl(path: string, query: URLSearchParams, name: string, value: string | null, prefix = '') {
    const next = new URLSearchParams(query);
    if (value) next.set(prefix + name, value);
    else next.delete(prefix + name);
    if (!['offset', 'event'].includes(name)) next.delete(prefix + 'offset');
    if (name !== 'event') next.delete(prefix + 'event');
    return `${path}${next.size ? `?${next.toString()}` : ''}`;
}
