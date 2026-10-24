'use client';
import Link from 'next/link';
import { Guard } from '../auth/session.js';
import { SessionsPanel } from '../auth/sessions-panel.js';
import { Brand } from '../../shared/ui/brand.js';
import { ThemeControl } from '../../ui/ThemeControl/ThemeControl.js';
import { AccountSecurity } from '../auth/account-security.js';
import styles from '../auth/account.module.css';
export function AccountPage() {
    return (
        <Guard context="user">
            <main id="main" className={styles.layout}>
                <Brand />
                <ThemeControl compact={false} />
                <h1>Аккаунт и безопасность</h1>
                <div className={styles.columns}>
                    <AccountSecurity />
                    <SessionsPanel context="user" />
                </div>
                <Link href="/settings/offline">Offline и устройство</Link>
                <Link href="/profile">Вернуться в профиль</Link>
            </main>
        </Guard>
    );
}
