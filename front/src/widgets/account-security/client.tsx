'use client';

import Link from 'next/link';
import { AccountSecurity, SessionsPanel } from '../../features/auth/client.js';
import styles from './account-security.module.css';

export function AccountPage() {
    return (
        <div className={styles.layout}>
            <h1>Аккаунт и безопасность</h1>
            <div className={styles.columns}>
                <AccountSecurity />
                <SessionsPanel context="user" />
            </div>
            <Link href="/settings/offline">Offline и устройство</Link>
            <Link href="/profile">Вернуться в профиль</Link>
        </div>
    );
}
