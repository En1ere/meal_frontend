'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRuntime } from '../../shared/runtime/index.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { useSession } from '../../entities/session/client.js';
import { ApiError } from '../../shared/api/client.js';
import { useWorkspaceScope } from '../../entities/workspace-scope/client.js';
import { familyKeys, useFamilyContext } from '../../entities/family/client.js';
import { keepExactAttempt, type ExactAttempt } from './exact-attempt.js';
import styles from './family.module.css';

function Content() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const router = useRouter();
    const setScope = useWorkspaceScope((state) => state.setScope);
    const [name, setName] = useState('');
    const [unknown, setUnknown] = useState(false);
    const [needsReadback, setNeedsReadback] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [reconciling, setReconciling] = useState(false);
    const attempt = useRef<ExactAttempt<{ name: string }> | null>(null);
    const submitting = useRef(false);
    const query = useFamilyContext(session.data?.id);
    const finish = (result: NonNullable<typeof query.data>) => {
        attempt.current = null;
        setUnknown(false);
        setNeedsReadback(false);
        queryClient.setQueryData(familyKeys.context(session.data?.id), result);
        setScope('family');
        router.replace('/family');
    };
    const readback = async () => {
        setReconciling(true);
        try {
            const refreshed = await query.refetch();
            if (refreshed.data?.state === 'active') {
                finish(refreshed.data);
                return 'active' as const;
            }
            if (refreshed.error) return 'failed' as const;
            return 'none' as const;
        } finally {
            setReconciling(false);
        }
    };
    const mutation = useMutation({
        mutationFn: async () => {
            attempt.current = keepExactAttempt(attempt.current, { name: name.trim() });
            await api!.request('POST /api/v1/family', attempt.current.body);
            return (await api!.request('GET /api/v1/family')).data;
        },
        onSuccess: (result) => {
            finish(result);
        },
        onError: async (error) => {
            const uncertain = !(error instanceof ApiError) || error.status >= 500;
            const state = await readback();
            if (state === 'active') return;
            if (uncertain) {
                setUnknown(true);
                setFeedback(
                    state === 'failed'
                        ? 'Результат запроса неизвестен, а перечитать семью не удалось. Название и ключ сохранены для точного повтора.'
                        : 'Результат запроса неизвестен. Семья пока не найдена; название и ключ сохранены для точного повтора.',
                );
            } else {
                attempt.current = null;
                setUnknown(false);
                setNeedsReadback(state === 'failed');
                setFeedback(
                    `${error.message}. ${
                        state === 'failed'
                            ? 'Перечитать семью не удалось; повторите проверку перед новым действием.'
                            : 'Состояние семьи перечитано; исправьте ввод и отправьте новое действие.'
                    }`,
                );
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
        setFeedback('');
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
                            disabled={mutation.isPending || unknown || needsReadback || reconciling}
                            maxLength={80}
                            required
                            autoComplete="off"
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Например, Наш дом"
                        />
                    </label>
                    <button
                        className="button primary"
                        disabled={mutation.isPending || reconciling || needsReadback || !name.trim()}
                    >
                        {mutation.isPending && <ArcInlineLoader label={null} />}
                        {unknown ? 'Повторить сохранённый запрос' : 'Создать семью'}
                    </button>
                    {(unknown || needsReadback) && (
                        <button
                            type="button"
                            className="button outline"
                            disabled={mutation.isPending || reconciling}
                            onClick={() => {
                                void (async () => {
                                    const state = await readback();
                                    if (state === 'none') {
                                        if (needsReadback) setNeedsReadback(false);
                                        setFeedback(
                                            unknown
                                                ? 'Семья пока не найдена. Для безопасного продолжения повторите сохранённый запрос без изменения названия.'
                                                : 'Семья не создана. Проверка завершена; можно исправить название и отправить новое действие.',
                                        );
                                    } else if (state === 'failed')
                                        setFeedback(
                                            'Перечитать семью не удалось. Сохранённый запрос не изменён; попробуйте проверку ещё раз.',
                                        );
                                })();
                            }}
                        >
                            {reconciling ? 'Проверяем состояние…' : 'Перечитать состояние семьи'}
                        </button>
                    )}
                    {feedback && <p role="alert">{feedback}</p>}
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
        <>
            <Content />
        </>
    );
}
