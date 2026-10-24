import { z } from 'zod';
import type { Principal } from '../shared/api/contracts.generated.js';
import type { Repository } from './model.js';
import { defaultNotificationPreferences, type NotificationSettings } from '../features/notifications/preferences.js';

const changeSchema = z.strictObject({
    channel: z.enum(['browser', 'mobilePush', 'email']),
    enabled: z.boolean(),
});

// Development persistence adapter, NOT a backend endpoint or production authorization boundary.
// The caller obtains a fresh principal from the existing typed staff-auth API for each operation.
export class MockNotificationSettings {
    constructor(
        private readonly repository: Repository,
        private readonly authenticate: (signal: AbortSignal) => Promise<Principal>,
        private readonly now: () => number = Date.now,
    ) {}

    async read(signal: AbortSignal): Promise<NotificationSettings> {
        return this.access(signal);
    }

    async update(change: unknown, signal: AbortSignal): Promise<NotificationSettings> {
        return this.access(signal, changeSchema.parse(change));
    }

    private async access(signal: AbortSignal, change?: z.infer<typeof changeSchema>): Promise<NotificationSettings> {
        signal.throwIfAborted();
        const principal = await this.authenticate(signal);
        return this.repository.transaction((state) => {
            signal.throwIfAborted();
            const user = state.users.find((entry) => entry.id === principal.id);
            const session = state.sessions.find((entry) => entry.principal.sessionId === principal.sessionId);
            if (
                principal.context !== 'admin' ||
                !user?.active ||
                !user.verified ||
                user.role !== 'admin' ||
                !session ||
                session.revoked ||
                session.principal.id !== user.id ||
                session.principal.context !== 'admin' ||
                Date.parse(session.principal.expiresAt) <= this.now() ||
                !state.factors.some((factor) => factor.userId === user.id && factor.verified && !factor.revoked)
            )
                throw new Error('Доступ администратора отозван. Войдите заново.');
            const preferences = { ...(state.notificationPreferences[user.id] ?? defaultNotificationPreferences()) };
            const verifiedEmail = z.email().safeParse(user.email).success ? user.email : null;
            if (change) {
                if (change.channel === 'email' && change.enabled && !verifiedEmail)
                    throw new Error('Для email-уведомлений нужен подтверждённый адрес аккаунта.');
                preferences[change.channel] = change.enabled;
                state.notificationPreferences[user.id] = preferences;
            }
            return { preferences, verifiedEmail };
        });
    }
}
