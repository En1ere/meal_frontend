'use client';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { resolveTheme, ThemeSwitcher, type ThemeName } from '@meal-planner/design-system';
import { useRuntime, useUi } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { Guard, useSession } from '../auth/session.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { profileFallbacks as fallback, profileText, recipeCountText } from './fallbacks.js';
import styles from './profile-pages.module.css';
import { useState, type ReactNode } from 'react';
import type { Success } from '../../shared/api/contracts.generated.js';
import { PublicRecipeFeed } from '../community/community.js';
import { FollowAuthorButton } from '../recommendations/actions.js';
import { FollowingList } from '../community/following.js';
import { PublicProgressSummary } from '../achievements/public-progress.js';
import { UserAppShell } from '../../ui/AppShell/UserAppShell.js';
import { PublicShell } from '../public-info/public-shell.js';

function ProfileShell({ children, own = false }: { children: ReactNode; own?: boolean }) {
    const content = <div className={styles.content}>{children}</div>;
    return own ? <UserAppShell>{content}</UserAppShell> : <PublicShell current="community">{content}</PublicShell>;
}
export function ProfileLoading() {
    return (
        <section className={styles.loading}>
            <ArcSkeleton width="60%" height="2em" label="Загружаем профиль" />
            <ArcSkeleton height="12em" label={null} />
            <div className={styles.columns}>
                <ArcSkeleton variant="lines" lines={5} label={null} />
                <ArcSkeleton variant="lines" lines={5} label={null} />
            </div>
        </section>
    );
}
function ProfileError({ error, retry }: { error: unknown; retry: () => void }) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
        <section className={styles.card} role="alert">
            <h1>{missing ? 'Профиль недоступен' : 'Не удалось загрузить профиль'}</h1>
            <p>
                {missing ? 'Автор не найден или его профиль недоступен.' : 'Проверьте подключение и попробуйте снова.'}
            </p>
            {!missing && (
                <button className="button outline" onClick={retry}>
                    Повторить
                </button>
            )}
            <Link href="/about">О сервисе</Link>
        </section>
    );
}
function ProfileAvatar({ src }: { src: string | null }) {
    const [failed, setFailed] = useState(false);
    const usable = src && (/^https:\/\//.test(src) || /^\/(?!\/)/.test(src));
    return usable && !failed ? (
        <img
            className={styles.avatar}
            src={src}
            alt="Аватар автора"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
        />
    ) : (
        <img className={styles.avatar} src="/assets/food-122-illustration.webp" alt={fallback.avatarUrl} />
    );
}
type OwnProfile = Success<'GET /api/v1/profile'>['data']['profile'];
function OwnProfileForm({
    profile,
    onSaved,
    onRefresh,
}: {
    profile: OwnProfile;
    onSaved: (value: OwnProfile) => void;
    onRefresh: () => void;
}) {
    const { api } = useRuntime();
    const setTheme = useUi((state) => state.setTheme);
    const [displayName, setDisplayName] = useState(profile.displayName ?? profile.username);
    const [timezone, setTimezone] = useState(profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    const activeTheme = useUi((state) => state.theme);
    const [theme, setThemeValue] = useState<ThemeName>(resolveTheme(profile.theme, activeTheme));
    const mutation = useMutation({
        mutationFn: async () =>
            (
                await api!.request('PUT /api/v1/profile', {
                    displayName,
                    timezone,
                    locale: 'ru',
                    theme,
                    expectedVersion: profile.version,
                    idempotencyKey: crypto.randomUUID(),
                })
            ).data.profile,
        onSuccess: (value) => {
            onSaved(value);
            setTheme(theme);
        },
        onError: onRefresh,
    });
    return (
        <form
            className={styles.form}
            onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate();
            }}
        >
            <label>
                Имя
                <input
                    required
                    minLength={1}
                    maxLength={100}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                />
            </label>
            <label>
                Часовой пояс
                <input
                    required
                    maxLength={100}
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    placeholder="Europe/Moscow"
                />
            </label>
            <label>
                Язык
                <select value="ru" disabled>
                    <option value="ru">Русский</option>
                </select>
            </label>
            <ThemeSwitcher value={theme} onChange={setThemeValue} />
            <p className={styles.note}>Логин задаётся при регистрации. Email меняется в разделе безопасности.</p>
            {mutation.isError && <p role="alert">Не удалось сохранить профиль. Обновите страницу и повторите.</p>}
            {mutation.isSuccess && <p role="status">Профиль сохранён.</p>}
            <button className="button primary" disabled={mutation.isPending}>
                Сохранить профиль
            </button>
        </form>
    );
}
function OwnContent() {
    const { api, queryClient } = useRuntime();
    const session = useSession('user');
    const query = useQuery({
        queryKey: ['profile', 'own', session.data?.id],
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            return (await api.request('GET /api/v1/profile', undefined, signal)).data.profile;
        },
    });
    if (query.isPending) return <ProfileLoading />;
    if (query.isError) return <ProfileError error={query.error} retry={() => void query.refetch()} />;
    const profile = query.data;
    return (
        <>
            <h1>Мой профиль</h1>
            <section className={styles.hero}>
                <div>
                    <ProfileAvatar key={profile.public.avatarUrl} src={profile.public.avatarUrl} />
                    <h2>{profile.username ? `@${profile.username}` : fallback.username}</h2>
                    {profile.username && (
                        <Link className="button primary" href={`/authors/${encodeURIComponent(profile.username)}`}>
                            Посмотреть публичный профиль
                        </Link>
                    )}
                </div>
                <img className={styles['hero-image']} src="/assets/achievements-kitchen-cover.webp" alt="" />
            </section>
            <div className={styles.columns}>
                <section className={styles.card}>
                    <h2>Публично видно</h2>
                    <dl>
                        <dt>Логин</dt>
                        <dd>{profileText(profile.username, fallback.username)}</dd>
                        <dt>Рецепты</dt>
                        <dd>{recipeCountText(profile.public.recipeCount)}</dd>
                        <dt>Репутация</dt>
                        <dd>
                            <Link href="/reputation">Открыть репутацию</Link>
                        </dd>
                        <dt>Достижения</dt>
                        <dd>
                            <Link href="/achievements">Открыть коллекцию</Link>
                        </dd>
                    </dl>
                    <p className={styles.note}>Имя и контакты не публикуются.</p>
                </section>
                <section className={styles.card}>
                    <h2>Только для вас</h2>
                    <OwnProfileForm
                        profile={profile}
                        onSaved={(value) => {
                            queryClient.setQueryData(['profile', 'own', session.data?.id], value);
                            queryClient.setQueryData(['session', 'user'], (old: typeof session.data) =>
                                old ? { ...old, displayName: value.displayName ?? value.username } : old,
                            );
                        }}
                        onRefresh={() => void query.refetch()}
                    />
                    <p>
                        Email: {profileText(profile.email, fallback.email)}{' '}
                        {profile.email && <small>{profile.emailVerified ? 'Подтверждён' : 'Не подтверждён'}</small>}
                    </p>
                    <Link href="/settings/account">Аккаунт и безопасность</Link>
                </section>
            </div>
            <section className={styles.card}>
                <h2>Мои подписки</h2>
                <FollowingList />
            </section>
        </>
    );
}
export function OwnProfilePage() {
    return (
        <Guard context="user">
            <ProfileShell own>
                <OwnContent />
            </ProfileShell>
        </Guard>
    );
}
export function PublicProfilePage({ username }: { username: string }) {
    const { api, error } = useRuntime();
    const query = useQuery({
        queryKey: ['profile', 'public', username],
        enabled: !!api,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            return (await api.request('GET /api/v1/authors/{username}', undefined, signal, { username })).data.profile;
        },
    });
    return (
        <ProfileShell>
            {error ? (
                <ProfileError error={error} retry={() => window.location.reload()} />
            ) : query.isPending ? (
                <ProfileLoading />
            ) : query.isError ? (
                <ProfileError error={query.error} retry={() => void query.refetch()} />
            ) : (
                <>
                    <section className={`${styles.hero} ${styles['author-hero']}`}>
                        <div>
                            <ProfileAvatar key={query.data.avatarUrl} src={query.data.avatarUrl} />
                            <h1>{query.data.username ? `@${query.data.username}` : fallback.username}</h1>
                            <FollowAuthorButton username={username} />
                            <PublicProgressSummary username={username} />
                        </div>
                        <img className={styles['hero-image']} src="/assets/achievements-kitchen-cover.webp" alt="" />
                    </section>
                    <section className={styles.card}>
                        <h2>Опубликованные рецепты</h2>
                        <p>{recipeCountText(query.data.recipeCount)}</p>
                        <PublicRecipeFeed author={username} returnTo={`/authors/${encodeURIComponent(username)}`} />
                    </section>
                    <section className={styles.card}>
                        <h2>Достижения и репутация</h2>
                        <p>Коллекция достижений, число репутации и звание публичны.</p>
                        <p>
                            <Link href={`/authors/${encodeURIComponent(username)}/achievements`}>
                                Открыть достижения
                            </Link>
                            {' · '}
                            <Link href={`/authors/${encodeURIComponent(username)}/reputation`}>Открыть репутацию</Link>
                        </p>
                    </section>
                </>
            )}
        </ProfileShell>
    );
}
