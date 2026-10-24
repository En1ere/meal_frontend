import { ProductDetailPage } from '../../../features/products/product-detail.js';
export const metadata = { title: 'Карточка продукта', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ProductDetailPage id={id} />;
}
