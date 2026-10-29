import { Suspense } from 'react';
import { PreserveLoading, PreservesPage } from '../../features/preserves/client.js';
export default function Page() {
    return (
        <Suspense fallback={<PreserveLoading />}>
            <PreservesPage />
        </Suspense>
    );
}
