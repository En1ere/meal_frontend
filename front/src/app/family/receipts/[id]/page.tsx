import { ReceiptDetailPage } from '../../../../features/receipts/detail-page.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return <ReceiptDetailPage id={(await params).id} scope="family" />;
}
