export type ExactAttempt<T extends object> = Readonly<{
    body: Readonly<T & { idempotencyKey: string }>;
}>;

export function keepExactAttempt<T extends object>(
    current: ExactAttempt<T> | null,
    body: T,
    createKey: () => string = () => crypto.randomUUID(),
): ExactAttempt<T> {
    if (current) return current;
    return {
        body: Object.freeze({ ...structuredClone(body), idempotencyKey: createKey() }),
    };
}
