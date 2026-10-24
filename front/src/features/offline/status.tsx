'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { subscribeOfflineState } from './offline-store.js';
import styles from './offline.module.css';

const onlineSnapshot = () => navigator.onLine;

export function OfflineStatus() {
    const online = useSyncExternalStore(subscribeOfflineState, onlineSnapshot, () => true);
    const [queued, setQueued] = useState(false);
    useEffect(() => {
        let timeout = 0;
        const show = () => {
            setQueued(true);
            window.clearTimeout(timeout);
            timeout = window.setTimeout(() => setQueued(false), 6000);
        };
        window.addEventListener('meal-planner-offline-queued', show);
        return () => {
            window.removeEventListener('meal-planner-offline-queued', show);
            window.clearTimeout(timeout);
        };
    }, []);
    if (online && !queued) return null;
    return (
        <div className={styles.banner} role="status" aria-live="polite">
            {queued
                ? 'Действие сохранено локально. Синхронизация начнётся при появлении сети.'
                : 'Вы офлайн. Доступны сохранённые данные и поддерживаемые локальные действия.'}
        </div>
    );
}
