import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts } from '../../shared/api/contracts.generated.js';

type Transport = Pick<ApiClient, 'request'>;
type Input<Route extends keyof typeof contracts> = z.input<(typeof contracts)[Route]['request']>;

export const loadAiCapabilities = async (transport: Transport, signal?: AbortSignal) =>
    (await transport.request('GET /api/v1/ai/capabilities', undefined, signal)).data;

export const loadAiBalance = async (transport: Transport, signal?: AbortSignal) =>
    (await transport.request('GET /api/v1/ai/balance', undefined, signal)).data;

export const previewAiTask = async (transport: Transport, input: Input<'POST /api/v1/ai/preview'>) =>
    (await transport.request('POST /api/v1/ai/preview', input)).data;

export const enqueueAiTask = async (transport: Transport, input: Input<'POST /api/v1/ai/operations'>) =>
    (await transport.request('POST /api/v1/ai/operations', input)).data;

export const loadAiConversation = async (transport: Transport, id: string, signal?: AbortSignal) =>
    (await transport.request('GET /api/v1/ai/tasks/{id}', undefined, signal, { id })).data;

export const loadAiOperation = async (transport: Transport, id: string, signal?: AbortSignal) =>
    (await transport.request('GET /api/v1/ai/operations/{id}', undefined, signal, { id })).data;

export const continueAiTask = async (
    transport: Transport,
    id: string,
    input: Input<'POST /api/v1/ai/tasks/{id}/operations'>,
) => (await transport.request('POST /api/v1/ai/tasks/{id}/operations', input, undefined, { id })).data;

export const loadAiHistory = async (
    transport: Transport,
    archived: 'active' | 'archived' | 'all',
    cursor: string | null,
    signal?: AbortSignal,
) =>
    (
        await transport.request('GET /api/v1/ai/history', undefined, signal, undefined, {
            query: { archived, limit: '20', ...(cursor ? { cursor } : {}) },
        })
    ).data;

export const setAiHistoryArchived = async (
    transport: Transport,
    id: string,
    input: Input<'PUT /api/v1/ai/history/{id}/archive'>,
) => (await transport.request('PUT /api/v1/ai/history/{id}/archive', input, undefined, { id })).data;

export const loadAiFamilySharing = async (transport: Transport, signal?: AbortSignal) =>
    (await transport.request('GET /api/v1/ai/family-sharing', undefined, signal)).data;

export const purchaseAiPackage = async (transport: Transport, input: Input<'POST /api/v1/ai/package/purchase'>) =>
    (await transport.request('POST /api/v1/ai/package/purchase', input)).data;

export const requestAiTransfer = async (transport: Transport, input: Input<'POST /api/v1/ai/transfers'>) =>
    (await transport.request('POST /api/v1/ai/transfers', input)).data;

export const decideAiTransfer = async (
    transport: Transport,
    id: string,
    input: Input<'POST /api/v1/ai/transfers/{id}/decision'>,
) => (await transport.request('POST /api/v1/ai/transfers/{id}/decision', input, undefined, { id })).data;
