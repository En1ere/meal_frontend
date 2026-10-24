import { Suspense } from 'react';
import { MealPlanPage, MealPlanLoading } from '../../features/meal-plan/page.js';

export const metadata = { title: 'План питания', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <Suspense fallback={<MealPlanLoading />}>
            <MealPlanPage />
        </Suspense>
    );
}
