// Portable copy of backend cooking lifecycle helpers; keep synchronized when these rules change.
export function cookingReminderSchedule(startedAt: string, timezone?: string) {
    const start = Date.parse(startedAt);
    if (!Number.isFinite(start)) throw new Error('Invalid cooking start');
    return {
        firstReminderAt: timezone
            ? cookingNotificationTime(start + 2 * 86400000, timezone)
            : new Date(start + 2 * 86400000).toISOString(),
        secondReminderAt: timezone
            ? cookingNotificationTime(start + 4 * 86400000, timezone)
            : new Date(start + 4 * 86400000).toISOString(),
        archiveAt: new Date(start + 6 * 86400000).toISOString(),
        quietHours: { start: '22:00', end: '09:00' } as const,
    };
}

export function cookingNotificationTime(timestamp: number, timezone: string): string {
    const format = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
    const localHour = (at: number) => Number(format.formatToParts(at).find((p) => p.type === 'hour')!.value);
    const hour = localHour(timestamp);
    if (hour >= 9 && hour < 22) return new Date(timestamp).toISOString();
    // Search real instants, rather than treating an IANA zone as a fixed UTC offset: DST can change overnight.
    const firstMinute = Math.ceil(timestamp / 60000) * 60000;
    for (let at = firstMinute; at <= firstMinute + 48 * 3600000; at += 60000) {
        const candidate = localHour(at);
        if (candidate >= 9 && candidate < 22) return new Date(at).toISOString();
    }
    throw new Error('No cooking notification delivery window');
}

export function cookingArchiveHiddenAt(archivedAt: string): string {
    const date = new Date(archivedAt),
        day = date.getUTCDate();
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid cooking archive date');
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
    return date.toISOString();
}
