import { InventoryDetailPage } from '../../../../features/inventory/detail-page.js';
export const metadata = { title: 'Партия продукта', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <InventoryDetailPage id={id} />;
}
