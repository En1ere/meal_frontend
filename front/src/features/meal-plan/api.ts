import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type MealPlanTransport = Pick<ApiClient, 'request'>;
export type MealPlanScope = 'private' | 'family';
export type MealPlanSelection = {
    scope: MealPlanScope;
    view: 'day' | 'week' | 'range' | 'calendar';
    date: string;
    timezone: string;
    endDate?: string;
};
export type MealPlanChangePreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/meal-plan/change-preview']['request']
>;
export type MealPlanChangeCommitCommand = z.input<
    (typeof contracts)['POST /api/v1/meal-plan/change-commit']['request']
>;
export type MealPlanShoppingPreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/meal-plan/shopping-preview']['request']
>;
export type MealPlanShoppingCommitCommand = z.input<
    (typeof contracts)['POST /api/v1/meal-plan/shopping-commit']['request']
>;
export type MealPlanPortionAssignCommand = z.input<(typeof contracts)['POST /api/v1/portions/assign']['request']>;
export type MealPlanPortionDecisionCommand = z.input<
    (typeof contracts)['POST /api/v1/portions/{id}/decision']['request']
>;
export type MealPlanAutomationPreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/meal-plan/automation-preview']['request']
>;
export type MealPlanAutomationCommitCommand = z.input<
    (typeof contracts)['POST /api/v1/meal-plan/automation-commit']['request']
>;

export async function loadMealPlanRecipes(
    transport: MealPlanTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/recipes'>['data']['items']> {
    return (
        await transport.request('GET /api/v1/recipes', undefined, signal, undefined, {
            query: { q: '', tab: 'new', page: '1', limit: '100' },
        })
    ).data.items;
}

export async function loadMealPlanEntitlements(
    transport: MealPlanTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/entitlements'>['data']> {
    return (await transport.request('GET /api/v1/entitlements', undefined, signal)).data;
}

export async function loadMealPlanFamily(
    transport: MealPlanTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/family'>['data']> {
    return (await transport.request('GET /api/v1/family', undefined, signal)).data;
}

export async function loadMealPlan(
    transport: MealPlanTransport,
    selection: MealPlanSelection,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/meal-plan'>['data']> {
    return (await transport.request('GET /api/v1/meal-plan', undefined, signal, undefined, { query: selection })).data;
}

export async function loadMealPlanPortions(
    transport: MealPlanTransport,
    scope: MealPlanScope,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/portions'>['data']> {
    return (await transport.request('GET /api/v1/portions', undefined, signal, undefined, { query: { scope } })).data;
}

export async function previewMealPlanChange(
    transport: MealPlanTransport,
    command: MealPlanChangePreviewCommand,
): Promise<Success<'POST /api/v1/meal-plan/change-preview'>['data']> {
    return (await transport.request('POST /api/v1/meal-plan/change-preview', command)).data;
}

export function commitMealPlanChange(
    transport: MealPlanTransport,
    command: MealPlanChangeCommitCommand,
): Promise<Success<'POST /api/v1/meal-plan/change-commit'>> {
    return transport.request('POST /api/v1/meal-plan/change-commit', command);
}

export async function previewMealPlanShopping(
    transport: MealPlanTransport,
    command: MealPlanShoppingPreviewCommand,
): Promise<Success<'POST /api/v1/meal-plan/shopping-preview'>['data']> {
    return (await transport.request('POST /api/v1/meal-plan/shopping-preview', command)).data;
}

export async function commitMealPlanShopping(
    transport: MealPlanTransport,
    command: MealPlanShoppingCommitCommand,
): Promise<Success<'POST /api/v1/meal-plan/shopping-commit'>['data']> {
    return (await transport.request('POST /api/v1/meal-plan/shopping-commit', command)).data;
}

export function assignMealPlanPortion(
    transport: MealPlanTransport,
    command: MealPlanPortionAssignCommand,
): Promise<Success<'POST /api/v1/portions/assign'>> {
    return transport.request('POST /api/v1/portions/assign', command);
}

export function decideMealPlanPortion(
    transport: MealPlanTransport,
    id: string,
    command: MealPlanPortionDecisionCommand,
): Promise<Success<'POST /api/v1/portions/{id}/decision'>> {
    return transport.request('POST /api/v1/portions/{id}/decision', command, undefined, { id });
}

export async function previewMealPlanAutomation(
    transport: MealPlanTransport,
    command: MealPlanAutomationPreviewCommand,
): Promise<Success<'POST /api/v1/meal-plan/automation-preview'>['data']> {
    return (await transport.request('POST /api/v1/meal-plan/automation-preview', command)).data;
}

export function commitMealPlanAutomation(
    transport: MealPlanTransport,
    command: MealPlanAutomationCommitCommand,
): Promise<Success<'POST /api/v1/meal-plan/automation-commit'>> {
    return transport.request('POST /api/v1/meal-plan/automation-commit', command);
}
