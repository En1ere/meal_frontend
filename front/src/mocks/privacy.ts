import { z } from 'zod';
import type { MockState } from './model.js';
const rowSchema = z.object({ version: z.number().int(), enabled: z.boolean(), acceptedAt: z.string().nullable() });
export const privacyMockSchema = z.record(z.string(), rowSchema);
export type PrivacyMock = z.infer<typeof privacyMockSchema>;
const consentVersion = 'demo-ai-data-access-v1';
export function privacyHandle(c: {
    state: MockState;
    userId: string | null;
    path: string;
    method: string;
    input: unknown;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
}): Response | null {
    const { state, userId, path, method, input, now, success, fail } = c;
    if (path !== '/api/v1/settings/privacy' && path !== '/api/v1/settings/privacy/ai-access') return null;
    if (!userId) return fail(401);
    const row = (state.privacy[userId] ??= { version: 0, enabled: false, acceptedAt: null });
    const result = () => ({
        version: row.version,
        aiAccess: {
            enabled: row.enabled,
            acceptedAt: row.acceptedAt,
            consentVersion,
            enableAvailable: true,
            demonstration: true,
        },
    });
    if (method === 'GET' && path === '/api/v1/settings/privacy') return success(result());
    if (method !== 'PUT') return fail(404);
    const parsed = z
        .object({
            enabled: z.boolean(),
            expectedVersion: z.number().int().nonnegative(),
            consentVersion: z.string().nullable(),
            accepted: z.boolean(),
            idempotencyKey: z.uuid(),
        })
        .strict()
        .safeParse(input);
    if (!parsed.success) return fail(400);
    const value = parsed.data;
    if (value.enabled && (!value.accepted || value.consentVersion !== consentVersion)) return fail(409);
    if (value.enabled === row.enabled) return success(result());
    if (value.expectedVersion !== row.version) return fail(412);
    row.enabled = value.enabled;
    row.acceptedAt = value.enabled ? new Date(now).toISOString() : null;
    row.version++;
    return success(result());
}
