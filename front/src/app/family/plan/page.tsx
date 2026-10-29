import { Suspense } from 'react';
import { MealPlanLoading, MealPlanPage } from '../../../features/meal-plan/client.js';

export const metadata = { title: 'Семейный план питания', robots: { index: false, follow: false } };

export default function Page() {
    return (
        <Suspense fallback={<MealPlanLoading />}>
            <MealPlanPage scope="family" />
        </Suspense>
    );
}
