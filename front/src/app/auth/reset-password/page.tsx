import { Suspense } from 'react';
import { ResetPasswordPage } from '../../../features/auth/lifecycle/client.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
export const metadata = {
    title: 'Новый пароль',
    robots: { index: false, follow: false },
    referrer: 'no-referrer' as const,
};
export default function Page() {
    return (
        <Suspense
            fallback={
                <main id="main">
                    <ArcPageLoader />
                </main>
            }
        >
            <ResetPasswordPage />
        </Suspense>
    );
}
