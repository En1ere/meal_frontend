'use client';

export const statusLabels = {
    preview: 'Предпросмотр',
    processing: 'В работе',
    completed: 'Готово',
    failed: 'Ошибка',
    refunded: 'Возвращено',
} as const;

export const taskClassLabels = { standard: 'обычная', advanced: 'расширенная', heavy: 'тяжёлая' } as const;

export const priorityLabels = { normal: 'обычный', pro: 'Pro' } as const;

export const actionLabel = (cost: number) => (cost === 1 ? 'AI-действие' : cost < 5 ? 'AI-действия' : 'AI-действий');

export function Frame({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
