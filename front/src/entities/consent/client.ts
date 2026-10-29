'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '../session/client.js';
import { ApiError } from '../../shared/api/client.js';
import { getLegalSettings, legalSettingsKey, type ConsentKind } from '../../shared/legal/mock-legal.js';
import { useRuntime } from '../../shared/runtime/index.js';

const consentRequiredCodes = new Set([
    'AI_PROCESSING_CONSENT_REQUIRED',
    'SPECIAL_CATEGORY_CONSENT_REQUIRED',
    'DISSEMINATION_CONSENT_REQUIRED',
    'MARKETING_CONSENT_REQUIRED',
]);

export function isConsentRequiredError(error: unknown) {
    return error instanceof ApiError && error.status === 403 && consentRequiredCodes.has(error.code);
}

export function useConsent(kind: ConsentKind) {
    const { api } = useRuntime();
    const session = useSession('user');
    const query = useQuery({
        queryKey: legalSettingsKey(session.data?.id),
        enabled: !!api && !!session.data,
        retry: false,
        queryFn: ({ signal }) => getLegalSettings(api!, signal),
    });
    return {
        ...query,
        enabled: query.data?.consents[kind].enabled === true,
        document: query.data?.documents.find((item) => item.id === kind),
    };
}
