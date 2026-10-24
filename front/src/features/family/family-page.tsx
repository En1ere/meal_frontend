'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime, useUi } from '../../app/providers.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Guard, useSession } from '../auth/session.js';
import { PersonalShell } from '../personalization/shell.js';
import styles from './family.module.css';

const entries = [
    ['Семейные запасы', 'Общие места, партии и движения продуктов', '/family/inventory'],
    ['Рецепты семьи', 'Рецепты, явно доступные участникам семьи', '/family/recipes'],
    ['Заготовки семьи', 'Общие партии, упаковки и QR-этикетки', '/family/preserves'],
    ['Общие покупки', 'Совместные списки, чеки и история действий', '/family/shopping'],
    ['Семейный план', 'Порции, участники, готовая еда и будущие покупки', '/family/plan'],
    ['Семейный чат', 'Сообщения, ответы и закрепления', '/family/chat'],
    ['Заметки', 'Текстовые заметки, история и общие чек-листы', '/family/notes'],
] as const;

function Content() {
    const { api } = useRuntime();
    const session = useSession('user');
    const setScope = useUi((state) => state.setScope);
    const query = useQuery({
        queryKey: ['family', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/family', undefined, signal)).data,
    });
    useEffect(() => {
        if (query.data?.state === 'active') setScope('family');
    }, [query.data?.state, setScope]);
    if (query.isPending)
        return (
            <div className={styles.stack}>
                <ArcSkeleton height="11rem" label="Загружаем семью" />
                <ArcSkeleton variant="lines" lines={5} label={null} />
            </div>
        );
    if (query.isError)
        return (
            <section className={styles.panel} role="alert">
                <h1>Семья не загрузилась</h1>
                <p>Проверьте подключение. Ошибка не означает, что состав или доступ изменились.</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    const context = query.data;
    if (context.state === 'none')
        return (
            <section className={styles.panel}>
                <p className={styles.eyebrow}>Plus · Семья</p>
                <h1>Общего дома пока нет</h1>
                <p>
                    Создайте семью или вступите по приглашению. Личные данные не переносятся в семейную область
                    автоматически.
                </p>
                {context.entitlement.capabilities.family ? (
                    <Link className="button primary" href="/family/setup">
                        Создать или вступить
                    </Link>
                ) : (
                    <>
                        <p className={styles.muted}>Для семейных возможностей нужен Plus или Pro.</p>
                        <Link className="button primary" href="/settings/subscription">
                            Посмотреть Plus
                        </Link>
                    </>
                )}
            </section>
        );
    const family = context.family!;
    return (
        <div className={styles.stack}>
            <section className={styles.hero}>
                <div>
                    <p className={styles.eyebrow}>Семейная область</p>
                    <h1>{family.name}</h1>
                    <p>
                        {family.memberCount} из {family.seatLimit} мест ·{' '}
                        {family.role === 'owner' ? 'Вы владелец' : 'Вы участник'}
                    </p>
                </div>
                <span className={styles.badge}>{context.entitlement.plan.toUpperCase()}</span>
            </section>
            {context.state === 'blocked' && (
                <section className={`${styles.panel} ${styles.notice}`} role="status">
                    <h2>Семейные действия приостановлены</h2>
                    <p>Состав семьи сохранён. Для содержимого и изменений нужно восстановить покрытие Plus или Pro.</p>
                    <Link className="button primary" href="/family/access">
                        Проверить доступ
                    </Link>
                </section>
            )}
            <section className={styles.panel}>
                <div className={styles.heading}>
                    <h2>Участники</h2>
                    <Link href="/family/members">Управление и приглашения</Link>
                    {family.role === 'owner' && <Link href="/family/ownership">Передать владение</Link>}
                </div>
                <ul className={styles.members}>
                    {family.members.map((member) => (
                        <li className={styles.member} key={member.id}>
                            <div>
                                <strong>{member.displayName}</strong>
                                <p className={styles.muted}>{member.role === 'owner' ? 'Владелец' : 'Участник'}</p>
                            </div>
                            {member.userId === session.data?.id && <span>Это вы</span>}
                        </li>
                    ))}
                </ul>
            </section>
            <section>
                <div className={styles.heading}>
                    <h2>Общие разделы</h2>
                    <Link href="/family/access">Доступ и выход</Link>
                </div>
                <div className={styles.entries}>
                    {entries.map(([title, description, href]) => (
                        <div className={styles.entry} key={title} aria-disabled={context.state !== 'active'}>
                            <span>
                                {context.state === 'active' ? (
                                    <Link href={href}>{title}</Link>
                                ) : (
                                    <strong>{title}</strong>
                                )}
                                <p className={styles.muted}>
                                    {context.state === 'active' ? description : 'Недоступно без семейного покрытия'}
                                </p>
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export function FamilyPage() {
    return (
        <Guard context="user">
            <PersonalShell>
                <Content />
            </PersonalShell>
        </Guard>
    );
}
