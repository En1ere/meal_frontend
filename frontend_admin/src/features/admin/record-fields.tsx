import type { Success } from '../../shared/api/contracts.generated.js';
import styles from './admin.module.css';
import type { Section } from './navigation.js';
import { displayField } from './display-values.js';

export type RecordItem = Success<'GET /api/v1/admin/{section}/{id}'>['data']['item'];
const recordNames: Partial<Record<Section, string>> = {
    subscriptions: 'Подписка',
    families: 'Семья',
    payments: 'Платёж',
    users: 'Пользователь',
    support: 'Обращение',
    sanctions: 'Санкция',
    operations: 'Задача',
    'legal-requests': 'Правовой запрос',
};
export function recordTitle(item: RecordItem, section?: Section) {
    return item.title === item.id
        ? `${section ? (recordNames[section] ?? 'Запись') : 'Запись'} · ${item.id.slice(-8)}`
        : item.title;
}
export function Fields({ item }: { item: RecordItem }) {
    return (
        <dl className={styles.fields}>
            {item.fields.map((field, index) => {
                const display = displayField(field, item.fields);
                return (
                    <div key={`${field.key}-${index}`}>
                        <dt>{display.label}</dt>
                        <dd>{display.value}</dd>
                    </div>
                );
            })}
        </dl>
    );
}
