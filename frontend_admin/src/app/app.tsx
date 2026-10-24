import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SignIn, MfaScreen } from '../features/auth/auth-screen.js';
import { StaffHome } from '../features/auth/sessions-panel.js';
import { Providers } from './providers.js';
import { AppErrorBoundary } from './error.js';
import NotFound from './not-found.js';
import { findSection } from '../features/admin/navigation.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';

const AdminPage = lazy(async () => ({ default: (await import('../features/admin/admin-page.js')).AdminPage }));
const NewsPage = lazy(async () => ({ default: (await import('../features/news/news-page.js')).NewsPage }));
const NotificationSettingsPage = lazy(async () => ({
    default: (await import('../features/notifications/notification-settings.js')).NotificationSettingsPage,
}));
const NotificationCenterPage = lazy(async () => ({
    default: (await import('../features/notifications/notification-center.js')).NotificationCenterPage,
}));
const RecipePolicyPage = lazy(async () => ({
    default: (await import('../features/settings/recipe-policy.js')).RecipePolicyPage,
}));
const AllergensPage = lazy(async () => ({
    default: (await import('../features/allergens/allergens-page.js')).AllergensPage,
}));
const ReleasesPage = lazy(async () => ({
    default: (await import('../features/releases/release-page.js')).ReleasesPage,
}));
const ReleaseDetailPage = lazy(async () => ({
    default: (await import('../features/releases/release-page.js')).ReleaseDetailPage,
}));
const AchievementsPage = lazy(async () => ({
    default: (await import('../features/releases/catalog-pages.js')).AchievementsPage,
}));
const ReputationPage = lazy(async () => ({
    default: (await import('../features/releases/catalog-pages.js')).ReputationPage,
}));
const ScenarioConsole =
    import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock'
        ? lazy(async () => ({ default: (await import('../mocks/scenario-console.js')).ScenarioConsole }))
        : null;

function RouteMetadata() {
    const { pathname } = useLocation();
    const previousPath = useRef(pathname);
    useEffect(() => {
        const titles: Record<string, string> = {
            '/': 'Администрирование',
            '/auth': 'Вход администратора',
            '/auth/mfa': 'Проверка входа',
            '/admin/catalog/allergens': 'Словарь аллергенов',
            '/admin/catalog/achievements': 'Достижения',
            '/admin/catalog/reputation': 'Репутация',
            '/settings/notifications': 'Настройки уведомлений',
            '/settings/recipes': 'Рецепты и антиспам',
            '/notifications': 'Центр уведомлений',
            '/dev/scenarios': 'Тестовые сценарии',
        };
        const segments = pathname.split('/').filter(Boolean);
        const section =
            segments[0] === 'admin' ? findSection(segments[1] === 'moderation' ? 'queues' : segments[1]) : undefined;
        const detail = section && segments.length > 2 && !(segments[1] === 'queues' && segments[2] === 'recipes');
        const title =
            titles[pathname] ?? (section ? `${detail ? 'Карточка · ' : ''}${section.title}` : 'Страница не найдена');
        document.title = `${title} · Meal Planner Admin`;
        if (previousPath.current === pathname) return;
        previousPath.current = pathname;
        const frame = requestAnimationFrame(() => {
            const main = document.getElementById('main');
            if (!main) return;
            main.tabIndex = -1;
            main.focus({ preventScroll: true });
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        });
        return () => cancelAnimationFrame(frame);
    }, [pathname]);
    return null;
}

export function App() {
    return (
        <AppErrorBoundary code="root_error">
            <BrowserRouter>
                <a className="skip-link" href="#main">
                    К содержимому
                </a>
                <RouteMetadata />
                <AppErrorBoundary code="route_error">
                    <Providers>
                        <Suspense fallback={<ArcPageLoader />}>
                            <Routes>
                                <Route path="/" element={<StaffHome context="admin" />} />
                                <Route path="/admin" element={<AdminPage />} />
                                <Route path="/admin/news" element={<NewsPage />} />
                                <Route path="/admin/catalog/allergens" element={<AllergensPage />} />
                                <Route path="/admin/catalog/allergens/:code" element={<AllergensPage />} />
                                <Route path="/admin/catalog/achievements" element={<AchievementsPage />} />
                                <Route path="/admin/catalog/achievements/:id" element={<AchievementsPage />} />
                                <Route path="/admin/catalog/reputation" element={<ReputationPage />} />
                                <Route path="/admin/releases" element={<ReleasesPage />} />
                                <Route path="/admin/releases/:id" element={<ReleaseDetailPage />} />
                                <Route path="/admin/queues" element={<Navigate replace to="/admin/queues/recipes" />} />
                                <Route path="/admin/queues/recipes" element={<AdminPage fixedSection="queues" />} />
                                <Route path="/admin/moderation/:id" element={<AdminPage fixedSection="queues" />} />
                                <Route
                                    path="/admin/operations/jobs/:id"
                                    element={<AdminPage fixedSection="operations" />}
                                />
                                <Route path="/admin/:section" element={<AdminPage />} />
                                <Route path="/admin/:section/:id" element={<AdminPage />} />
                                <Route path="/auth" element={<SignIn />} />
                                <Route path="/auth/mfa" element={<MfaScreen context="admin" />} />
                                <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
                                <Route path="/settings/recipes" element={<RecipePolicyPage />} />
                                <Route path="/notifications" element={<NotificationCenterPage />} />
                                {ScenarioConsole && <Route path="/dev/scenarios" element={<ScenarioConsole />} />}
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </Suspense>
                    </Providers>
                </AppErrorBoundary>
            </BrowserRouter>
        </AppErrorBoundary>
    );
}
