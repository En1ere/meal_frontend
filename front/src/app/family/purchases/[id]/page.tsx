import { PurchasePage } from '../../../../features/shopping/purchase-page.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return <PurchasePage id={(await params).id} scope="family" />;
}
