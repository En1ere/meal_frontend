'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { Success } from '../../shared/api/contracts.generated.js';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { Guard, useSession } from '../auth/session.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import styles from './public-progress.module.css';
import { UserAppShell } from '../../ui/AppShell/UserAppShell.js';
import { PublicShell } from '../public-info/public-shell.js';

type AchievementsPayload = Success<'GET /api/v1/authors/{username}/achievements'>['data'];
type ReputationPayload = Success<'GET /api/v1/authors/{username}/reputation'>['data'];
type IconMetadata = AchievementsPayload['achievements'][number]['icon'];

const fallbackIcons: Record<string, string> = {
    'achievement-culinary': '/assets/achievements/medal-gold-chef.png',
    'achievement-planning': '/assets/food-122-illustration.webp',
    'achievement-author': '/assets/achievements/medal-gold-chef.png',
    'achievement-community': '/assets/achievements/medal-silver-dialog.png',
    'achievement-family': '/assets/achievements/medal-bronze-book.png',
    'achievement-seasonal': '/assets/food-160.webp',
    recipe: '/assets/achievements/medal-gold-chef.png',
    correction: '/assets/achievements/medal-bronze-book.png',
    cook: '/assets/achievements/medal-silver-dialog.png',
    'reputation-recipes': '/assets/achievements/medal-gold-chef.png',
    'reputation-reactions': '/assets/achievements/medal-silver-dialog.png',
    'reputation-community': '/assets/food-021.webp',
    'reputation-tenure': '/assets/food-122-illustration.webp',
    'reputation-achievements': '/assets/food-160.webp',
    'reputation-moderation': '/assets/food-161.webp',
    'reputation-catalog': '/assets/achievements/medal-bronze-book.png',
    'reputation-completeness': '/assets/food-014.webp',
};

function iconSource(icon: IconMetadata): string {
    return fallbackIcons[icon.fallbackKey] ?? '/assets/achievements/medal-bronze-book.png';
}

function ProgressShell({ children, own = false }: { children: ReactNode; own?: boolean }) {
    const content = <div className={styles.content}>{children}</div>;
    return own ? <UserAppShell>{content}</UserAppShell> : <PublicShell current="community">{content}</PublicShell>;
}

function LoadingProgress() {
    return (
        <section className={styles.loading} aria-label="Загружаем достижения и репутацию">
            <ArcSkeleton width="50%" height="2.5em" label="Загружаем профиль" />
            <ArcSkeleton height="13em" label={null} />
            <ArcSkeleton variant="lines" lines={6} label={null} />
        </section>
    );
}

function ProgressError({ error, retry }: { error: unknown; retry: () => void }) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
        <section className={styles.panel} role="alert">
            <h1>{missing ? 'Профиль недоступен' : 'Не удалось загрузить данные'}</h1>
            <p>{missing ? 'Автор не найден или его профиль недоступен.' : 'Проверьте подключение и повторите.'}</p>
            {!missing && (
                <button className="button outline" onClick={retry}>
                    Повторить
                </button>
            )}
        </section>
    );
}

function Avatar({ username, src }: { username: string; src: string | null }) {
    const [failed, setFailed] = useState(false);
    const usable = src && (/^https:\/\//.test(src) || /^\/(?!\/)/.test(src));
    return usable && !failed ? (
        <img className={styles.avatar} src={src} alt={`Аватар @${username}`} onError={() => setFailed(true)} />
    ) : (
        <img className={styles.avatar} src="/assets/food-122-illustration.webp" alt="Аватар не добавлен" />
    );
}

function ProfileHero({
    profile,
    score,
    rank,
}: {
    profile: AchievementsPayload['profile'];
    score: number;
    rank: string;
}) {
    return (
        <section className={styles.hero}>
            <div className={styles['hero-profile']}>
                <Avatar username={profile.username} src={profile.avatarUrl} />
                <div>
                    <h2>@{profile.username}</h2>
                    <p className={styles.score}>{score.toLocaleString('ru-RU')}</p>
                    <p className={styles.rank}>{rank}</p>
                </div>
            </div>
            <img className={styles['hero-image']} src="/assets/achievements-kitchen-cover.webp" alt="" />
        </section>
    );
}

function AchievementsView({ data }: { data: AchievementsPayload }) {
    const [category, setCategory] = useState('all');
    const [order, setOrder] = useState<'catalog' | 'newest'>('catalog');
    const visible = useMemo(() => {
        const selected =
            category === 'all' ? data.achievements : data.achievements.filter((item) => item.category === category);
        return order === 'newest'
            ? [...selected].sort((left, right) => (right.earnedAt ?? '').localeCompare(left.earnedAt ?? ''))
            : selected;
    }, [category, data.achievements, order]);
    const earned = data.achievements.filter((item) => item.status === 'earned');
    return (
        <>
            <div className={styles.heading}>
                <div>
                    <p className={styles.eyebrow}>Публичный профиль</p>
                    <h1>Достижения</h1>
                </div>
                <div className={styles.tabs} aria-label="Раздел профиля">
                    <span aria-current="page">Достижения</span>
                    <Link href={`/authors/${encodeURIComponent(data.profile.username)}/reputation`}>Репутация</Link>
                </div>
            </div>
            <ProfileHero profile={data.profile} score={data.reputation.score} rank={data.reputation.rank.title} />
            <section aria-labelledby="collection-heading">
                <div className={styles['section-heading']}>
                    <div>
                        <h2 id="collection-heading">Коллекция</h2>
                        <p>
                            {earned.length} из {data.achievements.length} получено
                        </p>
                    </div>
                    <label className={styles.sort}>
                        <span>Порядок</span>
                        <select
                            value={order}
                            onChange={(event) => setOrder(event.target.value === 'newest' ? 'newest' : 'catalog')}
                        >
                            <option value="catalog">По каталогу</option>
                            <option value="newest">Сначала новые</option>
                        </select>
                    </label>
                </div>
                <div className={styles.filters} aria-label="Категории достижений">
                    <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
                        Все
                    </button>
                    {data.categories.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            aria-pressed={category === item.id}
                            onClick={() => setCategory(item.id)}
                        >
                            {item.title}
                        </button>
                    ))}
                </div>
                {visible.length === 0 ? (
                    <p className={styles.empty}>В этой категории пока нет достижений.</p>
                ) : (
                    <ul className={styles.grid}>
                        {visible.map((item) => {
                            const secretLocked = item.secret && item.status === 'locked';
                            return (
                                <li key={item.id} className={item.status === 'earned' ? styles.earned : styles.locked}>
                                    <img src={iconSource(item.icon)} alt={secretLocked ? '' : item.icon.alt} />
                                    <div>
                                        <h3>{secretLocked ? 'Секретное достижение' : item.title}</h3>
                                        <p>{secretLocked ? 'Условие откроется позже.' : item.description}</p>
                                        <small>
                                            {item.earnedAt
                                                ? `Получено ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(item.earnedAt))}`
                                                : 'Пока не получено'}
                                        </small>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
            <p className={styles.notice}>
                Достижения открываются автоматически. Условия и факт получения приходят с сервера.
            </p>
        </>
    );
}

function ReputationView({ data }: { data: ReputationPayload }) {
    const currentIndex = data.ranks.findIndex((rank) => rank.id === data.rank.id);
    return (
        <>
            <div className={styles.heading}>
                <div>
                    <p className={styles.eyebrow}>Публичный профиль</p>
                    <h1>Репутация</h1>
                </div>
                <div className={styles.tabs} aria-label="Раздел профиля">
                    <Link href={`/authors/${encodeURIComponent(data.profile.username)}/achievements`}>Достижения</Link>
                    <span aria-current="page">Репутация</span>
                </div>
            </div>
            <ProfileHero profile={data.profile} score={data.score} rank={data.rank.title} />
            <section className={styles.panel}>
                <h2>Что влияет на репутацию</h2>
                <p className={styles.explanation}>
                    Сервис учитывает вклад пользователя. Точная формула и антифрод-пороги не раскрываются.
                </p>
                <ul className={styles['factor-grid']}>
                    {data.factors.map((factor) => (
                        <li key={factor.id}>
                            <img src={iconSource(factor.icon)} alt={factor.icon.alt} />
                            <span>{factor.title}</span>
                        </li>
                    ))}
                </ul>
            </section>
            <section className={styles.panel}>
                <h2>Звания</h2>
                <ol className={styles.levels}>
                    {data.ranks.map((rank, index) => (
                        <li
                            key={rank.id}
                            className={
                                index === currentIndex ? styles.current : index < currentIndex ? styles.passed : ''
                            }
                        >
                            <strong>{rank.title}</strong>
                            <span>от {rank.minimumScore.toLocaleString('ru-RU')}</span>
                            {index === currentIndex && <small>Текущее звание</small>}
                        </li>
                    ))}
                </ol>
            </section>
            <p className={styles.notice}>
                Главный показатель — целое число репутации; звание определяется серверным брейкпоинтом.
            </p>
        </>
    );
}

function PublicAchievementsContent({ username }: { username: string }) {
    const { api, error } = useRuntime();
    const query = useQuery({
        queryKey: ['profile', 'public', username, 'achievements'],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/authors/{username}/achievements', undefined, signal, { username })).data,
    });
    if (error) return <ProgressError error={error} retry={() => window.location.reload()} />;
    if (query.isPending) return <LoadingProgress />;
    if (query.isError) return <ProgressError error={query.error} retry={() => void query.refetch()} />;
    return <AchievementsView data={query.data} />;
}

function PublicReputationContent({ username }: { username: string }) {
    const { api, error } = useRuntime();
    const query = useQuery({
        queryKey: ['profile', 'public', username, 'reputation'],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/authors/{username}/reputation', undefined, signal, { username })).data,
    });
    if (error) return <ProgressError error={error} retry={() => window.location.reload()} />;
    if (query.isPending) return <LoadingProgress />;
    if (query.isError) return <ProgressError error={query.error} retry={() => void query.refetch()} />;
    return <ReputationView data={query.data} />;
}

function OwnProgress({ view }: { view: 'achievements' | 'reputation' }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const profile = useQuery({
        queryKey: ['profile', 'own', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/profile', undefined, signal)).data.profile,
    });
    if (profile.isPending) return <LoadingProgress />;
    if (profile.isError) return <ProgressError error={profile.error} retry={() => void profile.refetch()} />;
    return view === 'achievements' ? (
        <PublicAchievementsContent username={profile.data.username} />
    ) : (
        <PublicReputationContent username={profile.data.username} />
    );
}

export function PublicAchievementsPage({ username }: { username: string }) {
    return (
        <ProgressShell>
            <PublicAchievementsContent username={username} />
        </ProgressShell>
    );
}

export function PublicReputationPage({ username }: { username: string }) {
    return (
        <ProgressShell>
            <PublicReputationContent username={username} />
        </ProgressShell>
    );
}

export function OwnAchievementsPage() {
    return (
        <Guard context="user">
            <ProgressShell own>
                <OwnProgress view="achievements" />
            </ProgressShell>
        </Guard>
    );
}

export function OwnReputationPage() {
    return (
        <Guard context="user">
            <ProgressShell own>
                <OwnProgress view="reputation" />
            </ProgressShell>
        </Guard>
    );
}

export function PublicProgressSummary({ username }: { username: string }) {
    const { api } = useRuntime();
    const query = useQuery({
        queryKey: ['profile', 'public', username, 'reputation'],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/authors/{username}/reputation', undefined, signal, { username })).data,
    });
    return (
        <div className={styles.summary}>
            {query.isPending ? (
                <ArcSkeleton width="9em" height="2.5em" label="Загружаем репутацию" />
            ) : query.isError ? (
                <p>Репутация временно недоступна.</p>
            ) : (
                <p>
                    <strong>{query.data.score.toLocaleString('ru-RU')}</strong>
                    <span className={styles['summary-rank']}>{query.data.rank.title}</span>
                </p>
            )}
            <div>
                <Link href={`/authors/${encodeURIComponent(username)}/achievements`}>Все достижения</Link>
                <Link href={`/authors/${encodeURIComponent(username)}/reputation`}>Репутация</Link>
            </div>
        </div>
    );
}
