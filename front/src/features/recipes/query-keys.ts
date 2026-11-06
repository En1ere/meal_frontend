import type { catalogState } from './url-state.js';
import { recipeQueryRoots } from '../../entities/recipe/query-keys.js';

export const recipeKeys = {
    cookingRoot: recipeQueryRoots.cookingRoot,
    cookingReminderPreferences: (userId: string | undefined) => ['cooking', userId, 'reminder-preferences'] as const,
    cookingList: (owner: string | null | undefined, view: 'current' | 'archive' | 'all') =>
        ['cooking', owner, 'list', view] as const,
    cookingAttempt: (owner: string | null | undefined, attemptId: string | null) =>
        ['cooking', owner, attemptId] as const,
    cookingRecipe: (userId: string | undefined, id: string) => ['cooking', userId, 'recipe', id] as const,
    communityRoot: ['recipe-community'] as const,
    community: (userId: string | undefined, id: string) => ['recipe-community', userId, id] as const,
    publicDetail: (id: string) => ['recipes', 'public', id] as const,
    personalRoot: ['recipes', 'personal'] as const,
    personalDetail: (userId: string | undefined, id: string) => ['recipes', 'personal', userId, id] as const,
    personal: (userId: string | undefined, id: string, servings: number) =>
        ['recipes', 'personal', userId, id, servings] as const,
    statistics: (id: string, servings: number) => ['recipes', 'statistics', id, servings] as const,
    workspaceRoot: recipeQueryRoots.workspaceRoot,
    workspaceDetail: (owner: string | null | undefined, scope: 'private' | 'family', id: string | undefined) =>
        ['recipe-workspace', owner, scope, id] as const,
    workspaceList: (
        owner: string | null | undefined,
        scope: 'private' | 'family',
        q: string,
        status: 'active' | 'archived',
        page: number,
    ) => ['recipe-workspace', owner, scope, q, status, page] as const,
    workspaceOfflineNew: (owner: string | null | undefined, draftId: string) =>
        ['recipe-workspace', owner, 'new', draftId, 'offline'] as const,
    offlineDraftState: (owner: string | null | undefined, draftId: string) =>
        ['offline-draft-state', owner, draftId] as const,
    catalog: (userId: string | undefined, state: ReturnType<typeof catalogState>) =>
        ['recipes', 'catalog', userId, state] as const,
    familyDetail: (userId: string | undefined, id: string) => ['recipe-workspace', userId, 'family', id] as const,
    preparedStockOptions: (userId: string | undefined) => ['cooking', userId, 'stock-options'] as const,
    publicCommunity: (author: string | undefined, q: string, category: string, sort: 'newest' | 'oldest') =>
        ['community', author, q, category, sort] as const,
    publicComments: (recipeId: string) => ['public-comments', recipeId] as const,
    reports: (userId: string | undefined, page: number) => ['recipe-community', userId, 'reports', page] as const,
    report: (userId: string | undefined, id: string) => ['recipe-report', userId, id] as const,
};
