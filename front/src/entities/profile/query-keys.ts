export const profileKeys = {
    own: (userId: string | undefined) => ['profile', 'own', userId] as const,
    public: (username: string) => ['profile', 'public', username] as const,
    publicAchievements: (username: string) => ['profile', 'public', username, 'achievements'] as const,
    publicReputation: (username: string) => ['profile', 'public', username, 'reputation'] as const,
};
