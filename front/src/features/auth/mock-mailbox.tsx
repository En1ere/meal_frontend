'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { Field, Submit, Feedback, useAccountAction } from './form-parts.js';
import styles from './account.module.css';
const paths = {
    verify: '/auth/verify-email',
    reset: '/auth/reset-password',
    'email-confirm': '/auth/email-change/confirm',
    'email-cancel': '/auth/email-change/cancel',
};
const labels = {
    verify: 'Подтвердить почту',
    reset: 'Задать новый пароль',
    'email-confirm': 'Подтвердить новый адрес',
    'email-cancel': 'Отменить смену адреса',
};
export function MockMailbox() {
    const runtime = useRuntime();
    const action = useAccountAction();
    const [email, setEmail] = useState('');
    const [messages, setMessages] = useState<Success<'POST /api/v1/dev/mailbox'>['data']['messages'] | null>(null);
    return (
        <main id="main" className={styles.layout}>
            <h1>Тестовая почта</h1>
            <p>
                Письма только этого локального браузера. Настоящей отправки нет. Экран недоступен в production и при
                работе с реальным API.
            </p>
            <form
                className={styles.stack}
                aria-busy={action.pending}
                onSubmit={(event) => {
                    event.preventDefault();
                    void action.run(async (signal) => {
                        const response = await runtime.api!.request('POST /api/v1/dev/mailbox', { email }, signal);
                        signal.throwIfAborted();
                        setMessages(response.data.messages);
                    });
                }}
            >
                <Field
                    label="Адрес тестовой почты"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setMessages(null);
                    }}
                    disabled={action.pending}
                />
                <Submit pending={action.pending} disabled={!runtime.api}>
                    Показать письма
                </Submit>
            </form>
            <Feedback error={action.error || runtime.error || undefined} />
            {messages &&
                (messages.length ? (
                    <ul className={styles['mail-list']}>
                        {messages.map((message) => (
                            <li key={message.id} className={styles.card}>
                                <h2>{labels[message.kind]}</h2>
                                <p>
                                    Создано {new Date(message.createdAt).toLocaleString('ru-RU')}. Срок действия до{' '}
                                    {new Date(message.expiresAt).toLocaleString('ru-RU')}.
                                </p>
                                <Link
                                    prefetch={false}
                                    href={`${paths[message.kind]}?token=${encodeURIComponent(message.token)}`}
                                >
                                    {labels[message.kind]}
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p role="status">Писем для этого адреса пока нет.</p>
                ))}
            <Link href="/auth">Ко входу</Link>
            <Link href="/settings/account">К безопасности аккаунта</Link>
        </main>
    );
}
