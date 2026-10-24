import { Suspense } from 'react';
import { PreserveDetailPage } from '../../../features/preserves/detail.js';
import { PreserveLoading } from '../../../features/preserves/shared.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<PreserveLoading />}>
            <PreserveDetailPage id={id} />
        </Suspense>
    );
}
