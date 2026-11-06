import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type NutritionSettings = Success<'GET /api/v1/nutrition/settings'>['data'];
export type NutritionAnalytics = Success<'GET /api/v1/nutrition/analytics'>['data'];
export type SaveNutritionProfileCommand = Omit<
    z.input<(typeof contracts)['PUT /api/v1/nutrition/profile']['request']>,
    'idempotencyKey'
>;
export type SaveNutritionTargetCommand = Omit<
    z.input<(typeof contracts)['POST /api/v1/nutrition/targets']['request']>,
    'idempotencyKey'
>;

export type NutritionTransport = Pick<ApiClient, 'request'>;

export async function loadNutritionSettings(
    transport: NutritionTransport,
    signal?: AbortSignal,
): Promise<NutritionSettings> {
    const response = await transport.request('GET /api/v1/nutrition/settings', undefined, signal);
    return response.data;
}

export async function loadNutritionAnalytics(
    transport: NutritionTransport,
    from: string,
    to: string,
    signal?: AbortSignal,
): Promise<NutritionAnalytics> {
    const response = await transport.request('GET /api/v1/nutrition/analytics', undefined, signal, undefined, {
        query: { from, to },
    });
    return response.data;
}

export function saveNutritionProfile(
    transport: NutritionTransport,
    command: SaveNutritionProfileCommand,
): Promise<Success<'PUT /api/v1/nutrition/profile'>> {
    return transport.request(
        'PUT /api/v1/nutrition/profile',
        { ...command, idempotencyKey: crypto.randomUUID() },
        undefined,
        undefined,
        command.expectedVersion === null ? undefined : { ifMatch: command.expectedVersion },
    );
}

export function saveNutritionTarget(
    transport: NutritionTransport,
    command: SaveNutritionTargetCommand,
): Promise<Success<'POST /api/v1/nutrition/targets'>> {
    return transport.request(
        'POST /api/v1/nutrition/targets',
        { ...command, idempotencyKey: crypto.randomUUID() },
        undefined,
        undefined,
        { ifMatch: command.expectedProfileVersion },
    );
}
