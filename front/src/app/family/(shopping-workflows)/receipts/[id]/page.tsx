import { ReceiptDetailPage } from '../../../../../features/shopping/client.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return <ReceiptDetailPage id={(await params).id} scope="family" />;
}
