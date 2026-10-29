import { PurchasePage } from '../../../../../features/shopping/client.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return <PurchasePage id={(await params).id} scope="family" />;
}
