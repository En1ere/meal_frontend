import { PreserveDetailPage } from '../../../../features/preserves/client.js';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return <PreserveDetailPage id={(await params).id} scope="family" />;
}
