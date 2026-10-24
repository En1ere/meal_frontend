import { Suspense } from 'react';
import { PreservesPage } from '../../features/preserves/list.js';
import { PreserveLoading } from '../../features/preserves/shared.js';
export default function Page() {
    return (
        <Suspense fallback={<PreserveLoading />}>
            <PreservesPage />
        </Suspense>
    );
}
