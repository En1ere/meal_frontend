export const recommendationKeys = {
    recipe: (userId: string | undefined, scope: 'personal' | 'private' | 'family', limit: number) =>
        ['recommendations', 'recipe', userId, scope, limit] as const,
    author: (userId: string | undefined, limit: number) => ['recommendations', 'author', userId, limit] as const,
    followingRoot: ['profile-following'] as const,
    following: (userId: string | undefined) => ['profile-following', userId] as const,
    authorFollow: (userId: string | undefined, username: string) => ['author-follow', userId, username] as const,
};
