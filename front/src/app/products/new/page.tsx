import { ProductNewPage } from '../../../features/products/client.js';
export const metadata = { title: 'Новый продукт', robots: { index: false, follow: false } };
export default function Page() {
    return <ProductNewPage />;
}
