import type { MockState } from './model.js';
import { mockPublicProgress, reputationRanks } from './achievement-catalog.js';

const reputationFactors = [
    ['published-own-recipe', '+5 за самостоятельный опубликованный рецепт', 'recipe'],
    ['accepted-content-correction', '+2 за подтверждённое содержательное исправление', 'correction'],
    ['first-independent-cook', '+1 за первую независимую готовку рецепта', 'cook'],
] as const;

export function publicProgressHandle(input: {
    state: MockState;
    path: string;
    success: (data: unknown) => Response;
    fail: (status: number, code?: string) => Response;
}): Response | null {
    if (input.path === '/api/v1/reputation/levels') {
        return input.success({
            items: reputationRanks.map((rank, index) => ({
                level: index + 1,
                threshold: rank.minimumScore,
                title: rank.title,
            })),
        });
    }
    const match = /^\/api\/v1\/authors\/([^/]+)\/(achievements|reputation)$/.exec(input.path);
    if (!match) return null;
    let username: string;
    try {
        username = decodeURIComponent(match[1]!).toLowerCase();
    } catch {
        return input.fail(400);
    }
    const author = input.state.users.find((user) => user.login === username && user.active && user.verified);
    if (!author) return input.fail(404);
    const progress = mockPublicProgress(author.login, null);
    if (match[2] === 'achievements') return input.success(progress);
    return input.success({
        profile: progress.profile,
        score: progress.reputation.score,
        rank: progress.reputation.rank,
        ranks: reputationRanks,
        factors: reputationFactors.map(([id, title, fallbackKey]) => ({
            id,
            title,
            icon: { assetId: null, fallbackKey, alt: `${title} — фактор репутации` },
        })),
    });
}
