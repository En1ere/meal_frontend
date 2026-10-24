import { z } from 'zod';
import type { AdminRow } from './admin-model.js';

const stateSchema = z.discriminatedUnion('adapter', [
    z.strictObject({ adapter: z.literal('content-release'), state: z.enum(['draft', 'published']) }),
    z.strictObject({ adapter: z.literal('moderation'), state: z.enum(['published', 'hide', 'unpublish']) }),
    z.strictObject({
        adapter: z.literal('sanction'),
        state: z.strictObject({ revokedAt: z.iso.datetime().nullable(), endsAt: z.iso.datetime().nullable() }),
    }),
    z.strictObject({
        adapter: z.literal('settings.recipe-policy'),
        state: z.strictObject({
            submissionDailyLimit: z.number().int().positive(),
            commentHourlyLimit: z.number().int().positive(),
            reportDailyLimit: z.number().int().positive(),
        }),
    }),
]);
type State = z.infer<typeof stateSchema>;

const parseState = (adapter: unknown, value: unknown): State | null => {
    if (typeof adapter !== 'string' || typeof value !== 'string') return null;
    try {
        const parsed = JSON.parse(value) as unknown;
        const result = stateSchema.safeParse({ adapter, state: parsed });
        return result.success ? result.data : null;
    } catch {
        return null;
    }
};
const compatible = (before: State, after: State) => {
    if (before.adapter !== after.adapter) return false;
    if (before.adapter === 'content-release') return before.state === 'draft' && after.state === 'published';
    if (before.adapter === 'moderation') return before.state === 'published' && after.state !== 'published';
    return true;
};
const display = (value: State | null, fallback: unknown) => {
    if (value) return typeof value.state === 'string' ? value.state : JSON.stringify(value.state);
    if (typeof fallback === 'string' || typeof fallback === 'number' || typeof fallback === 'boolean')
        return String(fallback);
    return fallback == null ? 'unknown' : JSON.stringify(fallback);
};

export type MockRollbackInspection = {
    supported: boolean;
    ready: boolean;
    targetId: string;
    before: string;
    after: string;
    current: string;
    expectedVersion: number;
    actualVersion: number;
    reason: string;
};

/** Development equivalent of the backend allow-list. Unknown or malformed adapters never execute. */
export function inspectMockRollback(item: AdminRow, target: AdminRow | undefined): MockRollbackInspection {
    const before = parseState(item.adapter, item.before_snapshot);
    const after = parseState(item.adapter, item.after_snapshot);
    const current = parseState(target?.adapter, target?.state_snapshot);
    const expectedVersion = Number(item.expected_version ?? 0);
    const actualVersion = Number(target?.version ?? 0);
    const supported = !!before && !!after && compatible(before, after) && target?.adapter === item.adapter;
    const ready =
        supported &&
        !!current &&
        JSON.stringify(current) === JSON.stringify(after) &&
        actualVersion === expectedVersion;
    return {
        supported,
        ready,
        targetId: String(item.target_id ?? '00000000-0000-4000-8000-000000000000'),
        before: display(before, item.before_snapshot),
        after: display(after, item.after_snapshot),
        current: display(current, target?.state_snapshot),
        expectedVersion,
        actualVersion,
        reason: !supported
            ? 'Snapshot не входит в явный whitelist доменных компенсаторов.'
            : ready
              ? 'Состояние и версия совпадают; development-компенсатор готов.'
              : 'Версия или текущее состояние изменились после подготовки snapshot.',
    };
}

export function applyMockRollback(item: AdminRow, target: AdminRow): void {
    const inspection = inspectMockRollback(item, target);
    if (!inspection.ready) throw new Error('Компенсация больше небезопасна');
    target.state_snapshot = String(item.before_snapshot);
    target.version = inspection.actualVersion + 1;
}
