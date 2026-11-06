export type ModerationQueueFilters = {
    status: string;
    assignment: string;
    priority: string;
};

export const moderationKeys = {
    root: ['moderator'] as const,
    overview: ['moderator', 'overview'] as const,
    queueRoot: (queue: string) => ['moderator', 'queue', queue] as const,
    queue: (queue: string, filters: ModerationQueueFilters) => ['moderator', 'queue', queue, filters] as const,
    item: (id: string) => ['moderator', 'item', id] as const,
    support: (id: string) => ['moderator', 'support', id] as const,
};
