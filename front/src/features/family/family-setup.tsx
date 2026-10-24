'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRuntime, useUi } from '../../app/providers.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import { ApiError } from '../../shared/api/client.js';
import styles from './family.module.css';

function Content() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const router = useRouter();
    const setScope = useUi((state) => state.setScope);
    const [name, setName] = useState('');
    const idempotencyKey = useRef(crypto.randomUUID());
    const submitting = useRef(false);
    const query = useQuery({
        queryKey: ['family', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/family', undefined, signal)).data,
    });
    const mutation = useMutation({
        mutationFn: async () => {
            await api!.request('POST /api/v1/family', {
                name,
                idempotencyKey: idempotencyKey.current,
            });
            return (await api!.request('GET /api/v1/family')).data;
        },
        onSuccess: (result) => {
            queryClient.setQueryData(['family', session.data?.id], result);
            setScope('family');
            router.replace('/family');
        },
        onError: async (error) => {
            if (!(error instanceof ApiError) || ![403, 409, 412].includes(error.status)) return;
            const refreshed = await query.refetch();
            if (refreshed.data?.state === 'active') {
                setScope('family');
                router.replace('/family');
            }
        },
        onSettled: () => {
            submitting.current = false;
        },
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!name.trim() || submitting.current) return;
        submitting.current = true;
        mutation.mutate();
    };
    if (query.isPending) return <p role="status">Проверяем семейный доступ…</p>;
    if (query.isError)
        return (
            <section className={styles.panel} role="alert">
                <h1>Не удалось проверить семью</h1>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    if (query.data.state !== 'none')
        return (
            <section className={styles.panel}>
                <h1>Вы уже состоите в семье</h1>
                <p>Новая семья не создаётся поверх действующего членства.</p>
                <Link className="button primary" href="/family">
                    Открыть семью
                </Link>
            </section>
        );
    if (!query.data.entitlement.capabilities.family)
        return (
            <section className={styles.panel}>
                <h1>Нужен Plus или Pro</h1>
                <p>Личные данные останутся доступны, но создать семью на Free нельзя.</p>
                <Link className="button primary" href="/settings/subscription">
                    Посмотреть Plus
                </Link>
            </section>
        );
    return (
        <div className={styles.stack}>
            <section className={styles.panel}>
                <p className={styles.eyebrow}>Новая семья</p>
                <h1>Создайте общий дом</h1>
                <p>Создание семьи не переносит личные запасы, рецепты или покупки.</p>
                <p>Базовый семейный лимит — 4 участника. Дополнительные места учитываются текущим покрытием.</p>
                <form className={styles.form} onSubmit={submit}>
                    <label>
                        Название семьи
                        <input
                            value={name}
                            maxLength={80}
                            required
                            autoComplete="off"
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Например, Наш дом"
                        />
                    </label>
                    <button className="button primary" disabled={mutation.isPending || !name.trim()}>
                        {mutation.isPending && <ArcInlineLoader label={null} />}Создать семью
                    </button>
                    {mutation.isError && (
                        <p role="alert">
                            {mutation.error instanceof ApiError
                                ? `${mutation.error.message}. Ввод сохранён; состояние семьи перечитано.`
                                : 'Не удалось создать семью. Ввод сохранён; попробуйте ещё раз.'}
                        </p>
                    )}
                </form>
            </section>
            <section className={styles.panel}>
                <h2>Есть приглашение?</h2>
                <p>Откройте полученную ссылку. Семья и состав появятся только после проверки приглашения и входа.</p>
            </section>
        </div>
    );
}

export function FamilySetupPage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <Content />
            </PersonalShell>
        </Guard>
    );
}
