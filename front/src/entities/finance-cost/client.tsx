'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '../session/client.js';
import { useRuntime } from '../../shared/runtime/index.js';
import styles from './finance-cost.module.css';

export type FinanceCostRoute =
    | 'GET /api/v1/finance/costs/recipes/{id}'
    | 'GET /api/v1/finance/costs/shopping-lists/{id}'
    | 'GET /api/v1/finance/costs/meal-plans/{id}';

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });

export function CostEstimateBadge({ route, id }: { route: FinanceCostRoute; id: string }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const query = useQuery({
        queryKey: ['finance-cost', route, id, session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: ({ signal }) => api!.request(route, undefined, signal, { id }).then((response) => response.data),
        retry: false,
    });
    if (!query.data) return null;
    const value = query.data;
    return (
        <aside className={styles.badge} aria-label="Примерная стоимость">
            <span>Примерная стоимость</span>
            <strong>
                {value.complete && value.estimatedTotalMinor !== null
                    ? money.format(value.estimatedTotalMinor / 100)
                    : `от ${money.format(value.knownSubtotalMinor / 100)}`}
            </strong>
            <small>
                {value.complete
                    ? `${value.totalLineCount} позиций учтено`
                    : `Учтено ${value.knownLineCount} из ${value.totalLineCount}; итог неполный`}
            </small>
            <p>{value.disclaimer}</p>
        </aside>
    );
}
