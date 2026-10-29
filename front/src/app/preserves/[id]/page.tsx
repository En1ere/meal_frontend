import { Suspense } from 'react';
import { PreserveDetailPage, PreserveLoading } from '../../../features/preserves/client.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Suspense fallback={<PreserveLoading />}>
            <PreserveDetailPage id={id} />
        </Suspense>
    );
}
