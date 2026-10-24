import fixture from '../../contracts/dev-users.json' with { type: 'json' };
import { z } from 'zod';
import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import { accountStateSchema, createAccountState, type AccountState } from './account-model.js';
import { notificationPreferencesSchema, type NotificationPreferences } from '../features/notifications/preferences.js';
import { adminStateSchema, createAdminState, type AdminState } from './admin-model.js';
import { notificationCenterStateSchema, type NotificationCenterState } from './notification-center.js';
import { allergensStateSchema, createAllergensState, type AllergensState } from './allergens.js';
import {
    createReleaseWorkspaceState,
    releaseWorkspaceStateSchema,
    type ReleaseWorkspaceState,
} from './release-workspace.js';

export type Context = Principal['context'];
export type Kind = 'user' | 'staff';
export interface MockUser {
    id: string;
    login: string;
    email: string;
    name: string;
    role: string | null;
    plan: string;
    active: boolean;
    verified: boolean;
}
export interface Session {
    token: string;
    principal: Principal;
    authenticatedAt: string;
    revoked: boolean;
    adminUnlocks?: string[] | undefined;
    criticalConfirmedUntil?: string | undefined;
    adminMfaAttempts?: number | undefined;
}
export interface Factor {
    id: string;
    userId: string;
    secret: string;
    verified: boolean;
    revoked: boolean;
    lastStep: number;
    recoveryCodes: string[];
}
export interface Challenge {
    token: string;
    userId: string;
    context: 'admin' | 'moderator';
    factorId: string;
    expires: number;
    attempts: number;
    used: boolean;
    revoked: boolean;
    adminPortal?: boolean | undefined;
}
export interface MockState {
    releaseWorkspace: ReleaseWorkspaceState;
    allergens: AllergensState;
    notificationCenter: NotificationCenterState;
    version: 1;
    admin: AdminState;
    notificationPreferences: Record<string, NotificationPreferences>;
    account: AccountState;
    users: MockUser[];
    sessions: Session[];
    factors: Factor[];
    challenges: Challenge[];
    csrf: Record<string, string>;
    limits: Record<string, { started: number; attempts: number }>;
}
export const mockStateSchema: z.ZodType<MockState> = z.strictObject({
    releaseWorkspace: releaseWorkspaceStateSchema.default(createReleaseWorkspaceState),
    allergens: allergensStateSchema.default(createAllergensState),
    notificationCenter: notificationCenterStateSchema.default({}),
    version: z.literal(1),
    admin: adminStateSchema.default(createAdminState),
    notificationPreferences: z.record(z.string(), notificationPreferencesSchema).default({}),
    account: accountStateSchema.default(createAccountState),
    users: z.array(
        z.strictObject({
            id: z.uuid(),
            login: z.string(),
            email: z.string(),
            name: z.string(),
            role: z.string().nullable(),
            plan: z.string(),
            active: z.boolean(),
            verified: z.boolean(),
        }),
    ),
    sessions: z.array(
        z.strictObject({
            token: z.string(),
            principal: contracts['GET /api/v1/auth/me'].success.shape.data.shape.user,
            authenticatedAt: z.iso.datetime(),
            revoked: z.boolean(),
            adminUnlocks: z.array(z.string()).optional(),
            criticalConfirmedUntil: z.iso.datetime().optional(),
            adminMfaAttempts: z.number().optional(),
        }),
    ),
    factors: z.array(
        z.strictObject({
            id: z.uuid(),
            userId: z.uuid(),
            secret: z.string(),
            verified: z.boolean(),
            revoked: z.boolean(),
            lastStep: z.number(),
            recoveryCodes: z.array(z.string()),
        }),
    ),
    challenges: z.array(
        z.strictObject({
            token: z.string(),
            userId: z.uuid(),
            context: z.enum(['admin', 'moderator']),
            factorId: z.uuid(),
            expires: z.number(),
            attempts: z.number(),
            used: z.boolean(),
            revoked: z.boolean(),
            adminPortal: z.boolean().optional(),
        }),
    ),
    csrf: z.record(z.string(), z.string()),
    limits: z.record(z.string(), z.strictObject({ started: z.number(), attempts: z.number() })),
});
export const fixturePassword = fixture.password;
export const fixtureUserIds = new Set(fixture.users.map((user) => user.id));
export function createSeed(): MockState {
    const admin = createAdminState();
    return {
        releaseWorkspace: createReleaseWorkspaceState(),
        allergens: createAllergensState(),
        notificationCenter: {},
        version: 1,
        admin,
        notificationPreferences: {},
        account: createAccountState(),
        users: fixture.users.map((user) => ({ ...user, active: true, verified: true })),
        sessions: [],
        factors: [],
        challenges: [],
        csrf: {},
        limits: {},
    };
}
export interface Repository {
    // Synchronous callback keeps IndexedDB read-modify-write atomic across tabs.
    transaction<T>(work: (state: MockState) => T): Promise<T>;
}
