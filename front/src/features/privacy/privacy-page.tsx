'use client';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { safeReturnTo } from '../../shared/auth/routes.js';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import { getLegalSettings, legalSettingsKey, setConsent, type ConsentKind } from '../../shared/legal/mock-legal.js';
import styles from '../personalization/personalization.module.css';

const consentCopy: Record<ConsentKind, { title: string; description: string }> = {
    ai_data_access: {
        title: 'Использование личных данных в AI',
        description: 'Разрешает передавать выбранные данные профиля и запасов только в явно запущенную AI-задачу.',
    },
    special_category: {
        title: 'Данные о здоровье и питании',
        description:
            'Открывает дневник питания и сохранение аллергенов. Отзыв блокирует новые обращения к этим данным.',
    },
    dissemination: {
        title: 'Публикация материалов',
        description:
            'Разрешает отправлять рецепты на публикацию. Черновики, редактирование и удаление остаются доступны.',
    },
    marketing: {
        title: 'Маркетинговые сообщения',
        description: 'Разрешает рекламные и продуктовые предложения. Сервисные уведомления настраиваются отдельно.',
    },
};
function Content() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const params = useSearchParams();
    const requestedValue = params.get('consent');
    const requested = Object.hasOwn(consentCopy, requestedValue ?? '') ? (requestedValue as ConsentKind) : null;
    const rawReturnTo = params.get('returnTo');
    const returnTo = rawReturnTo ? safeReturnTo(rawReturnTo, 'user') : null;
    const requestedRef = useRef<HTMLElement>(null);
    const [mutationIssue, setMutationIssue] = useState<'conflict' | 'error' | 'reload-error' | null>(null);
    const key = legalSettingsKey(session.data?.id);
    const query = useQuery({
        queryKey: key,
        enabled: !!api && !!session.data,
        retry: false,
        queryFn: ({ signal }) => getLegalSettings(api!, signal),
    });
    const mutation = useMutation({
        onMutate: () => setMutationIssue(null),
        mutationFn: ({ kind, enabled }: { kind: ConsentKind; enabled: boolean }) => {
            const document = query.data!.documents.find((item) => item.id === kind);
            if (!document) throw new Error('Документ согласия недоступен.');
            return setConsent(api!, {
                kind,
                enabled,
                revision: query.data!.consents[kind].revision,
                document: document.document,
            });
        },
        onSuccess: (value) => {
            queryClient.setQueryData(key, value);
            setMutationIssue(null);
        },
        onError: async (error) => {
            const conflict =
                error instanceof ApiError &&
                (error.status === 412 || (error.status === 409 && error.code === 'LEGAL_DOCUMENT_STALE'));
            setMutationIssue(conflict ? 'conflict' : 'error');
            const refreshed = await query.refetch();
            if (refreshed.isError) setMutationIssue('reload-error');
        },
    });
    useEffect(() => {
        if (requested && query.data) requestedRef.current?.focus();
    }, [query.data, requested]);
    return (
        <>
            <h1>Документы и согласия</h1>
            <p>
                Здесь можно ознакомиться с действующими документами, выдать или отозвать отдельные согласия и увидеть
                историю изменений.
            </p>
            <section className={styles.notice}>
                <div>
                    <strong>Демонстрационный реестр</strong>
                    <p>Версии и события ниже нужны для проверки UX. Это не production-юридические данные.</p>
                </div>
                {returnTo && <Link href={returnTo}>Вернуться к функции</Link>}
            </section>
            {query.isPending ? (
                <p role="status">Загружаем документы и согласия…</p>
            ) : query.isError ? (
                <section className={styles.panel} role="alert">
                    <h2>Центр временно недоступен</h2>
                    <p>Функции, которым требуется согласие, остаются заблокированы.</p>
                    <button className="button outline" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </section>
            ) : (
                <>
                    <section className={styles.panel}>
                        <h2>Документы</h2>
                        <ul className={styles.list}>
                            {query.data.documents.map((document) => (
                                <li key={document.id}>
                                    <span>
                                        <strong>{document.title}</strong>
                                        <br />
                                        <small>
                                            Версия {document.version} ·{' '}
                                            {document.status === 'published' ? 'опубликован' : 'ещё не опубликован'}
                                        </small>
                                    </span>
                                    {document.status === 'published' && document.href ? (
                                        <Link href={document.href}>Открыть</Link>
                                    ) : (
                                        <span aria-disabled="true">Недоступен</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section className={styles.panel}>
                        <h2>Управление согласиями</h2>
                        <div className={styles.stack}>
                            {(Object.keys(consentCopy) as ConsentKind[]).map((kind) => {
                                const consent = query.data.consents[kind];
                                const document = query.data.documents.find((item) => item.id === kind);
                                const available = document?.status === 'published';
                                const highlighted = requested === kind;
                                return (
                                    <section
                                        key={kind}
                                        className={styles.card}
                                        ref={highlighted ? requestedRef : undefined}
                                        tabIndex={highlighted ? -1 : undefined}
                                        aria-labelledby={`consent-${kind}`}
                                    >
                                        <h3 id={`consent-${kind}`}>{consentCopy[kind].title}</h3>
                                        <p>{consentCopy[kind].description}</p>
                                        <p>
                                            <strong>{consent.enabled ? 'Разрешено' : 'Не разрешено'}</strong> · версия{' '}
                                            {document?.version ?? '—'}
                                            {consent.changedAt
                                                ? ` · с ${new Date(consent.changedAt).toLocaleString('ru-RU')}`
                                                : ''}
                                        </p>
                                        {!available && <p role="status">Документ не опубликован: выдача недоступна.</p>}
                                        <button
                                            className={consent.enabled ? 'button outline' : 'button primary'}
                                            disabled={
                                                mutation.isPending ||
                                                mutationIssue === 'reload-error' ||
                                                (!consent.enabled && !available)
                                            }
                                            onClick={() => mutation.mutate({ kind, enabled: !consent.enabled })}
                                        >
                                            {mutation.isPending && mutation.variables?.kind === kind
                                                ? 'Сохраняем…'
                                                : consent.enabled
                                                  ? 'Отозвать'
                                                  : 'Ознакомился и согласен'}
                                        </button>
                                    </section>
                                );
                            })}
                        </div>
                        <p role="status" aria-live="polite">
                            {mutation.isSuccess
                                ? `${consentCopy[mutation.variables.kind].title}: изменение сохранено.`
                                : ''}
                        </p>
                        {mutationIssue === 'conflict' && (
                            <p role="alert">
                                Согласие или документ изменились в другой вкладке. Актуальное состояние загружено:
                                перечитайте документ и повторите действие.
                            </p>
                        )}
                        {mutationIssue === 'error' && (
                            <p role="alert">Изменение не подтверждено. Актуальное состояние перечитано.</p>
                        )}
                        {mutationIssue === 'reload-error' && (
                            <section role="alert">
                                <p>
                                    Изменение не подтверждено, а актуальное состояние загрузить не удалось. Управление
                                    согласиями заблокировано до повторной проверки.
                                </p>
                                <button
                                    className="button outline"
                                    onClick={() => {
                                        void query.refetch().then((result) => {
                                            if (!result.isError) setMutationIssue(null);
                                        });
                                    }}
                                >
                                    Загрузить актуальное состояние
                                </button>
                            </section>
                        )}
                    </section>
                    <section className={styles.panel}>
                        <h2>История</h2>
                        {query.data.history.length ? (
                            <ul className={styles.list}>
                                {query.data.history.map((item) => (
                                    <li key={item.id}>
                                        <span>{consentCopy[item.kind].title}</span>
                                        <strong>
                                            {item.action === 'accepted' ? 'Выдано' : 'Отозвано'} ·{' '}
                                            {new Date(item.occurredAt).toLocaleString('ru-RU')}
                                        </strong>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>Изменений пока нет.</p>
                        )}
                    </section>
                </>
            )}
        </>
    );
}
export function PrivacyPage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <Content />
            </PersonalShell>
        </Guard>
    );
}
