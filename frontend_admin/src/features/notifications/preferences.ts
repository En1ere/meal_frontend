import { z } from 'zod';

export const notificationPreferencesSchema = z.strictObject({
    browser: z.boolean(),
    mobilePush: z.boolean(),
    email: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type NotificationChannel = keyof NotificationPreferences;
export interface NotificationSettings {
    preferences: NotificationPreferences;
    verifiedEmail: string | null;
}
export const defaultNotificationPreferences = (): NotificationPreferences => ({
    browser: false,
    mobilePush: false,
    email: false,
});
