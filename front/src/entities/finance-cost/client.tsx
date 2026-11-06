'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '../session/client.js';
import { useRuntime } from '../../shared/runtime/index.js';
import { loadFinanceCost } from './api.js';
import { financeCostKeys, type FinanceCostRoute } from './query-keys.js';
import styles from './finance-cost.module.css';

export type { FinanceCostRoute } from './query-keys.js';

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });

export function CostEstimateBadge({ route, id }: { route: FinanceCostRoute; id: string }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const query = useQuery({
        queryKey: financeCostKeys.estimate(route, id, session.data?.id),
        enabled: !!api && !!session.data,
        queryFn: ({ signal }) => loadFinanceCost(api!, route, id, signal),
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
