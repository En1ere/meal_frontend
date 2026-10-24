import { Suspense } from 'react';
import { FamilyNotesPage } from '../../../features/family-notes/notes-page.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
export const metadata = { title: 'Семейные заметки', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <Suspense fallback={<ArcSkeleton variant="lines" lines={6} label="Загружаем заметки" />}>
            <FamilyNotesPage />
        </Suspense>
    );
}
