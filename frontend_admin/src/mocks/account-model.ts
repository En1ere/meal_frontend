import { z } from 'zod';

// Browser-owned development fixtures only; this is not production credential storage.
export const accountStateSchema = z.strictObject({
    passwords: z.record(z.string(), z.string()).default({}),
    tokens: z
        .array(
            z.strictObject({
                token: z.string(),
                userId: z.string(),
                purpose: z.enum(['verify', 'reset', 'email-confirm', 'email-cancel']),
                expires: z.number(),
                used: z.boolean(),
                changeId: z.string().nullable(),
            }),
        )
        .default([]),
    pins: z
        .array(
            z.strictObject({
                token: z.string(),
                userId: z.string(),
                hash: z.string(),
                attempts: z.number(),
                revoked: z.boolean(),
            }),
        )
        .default([]),
    mail: z
        .array(
            z.strictObject({
                id: z.string(),
                email: z.string(),
                kind: z.enum(['verify', 'reset', 'email-confirm', 'email-cancel']),
                token: z.string(),
                createdAt: z.string(),
                expiresAt: z.string(),
            }),
        )
        .default([]),
    changes: z
        .array(
            z.strictObject({
                id: z.string(),
                userId: z.string(),
                oldEmail: z.string(),
                email: z.string(),
                executeAfter: z.number(),
                createdAt: z.number().default(0),
                confirmed: z.boolean(),
                cancelled: z.boolean(),
                completed: z.boolean(),
            }),
        )
        .default([]),
    enrollments: z
        .array(
            z.strictObject({
                token: z.string(),
                userId: z.string(),
                secret: z.string(),
                expires: z.number(),
                attempts: z.number(),
                used: z.boolean(),
                factorId: z.string().nullable(),
                sessionId: z.string().default(''),
            }),
        )
        .default([]),
    sends: z.record(z.string(), z.object({ start: z.number(), count: z.number(), last: z.number() })).default({}),
});
export type AccountState = z.infer<typeof accountStateSchema>;
export const createAccountState = (): AccountState => accountStateSchema.parse({});
export async function mockDigest(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`development-mock-only:${value}`));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
