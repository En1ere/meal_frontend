import { ProductNewPage } from '../../../features/products/product-new.js';
export const metadata = { title: 'Новый продукт', robots: { index: false, follow: false } };
export default function Page() {
    return <ProductNewPage />;
}
