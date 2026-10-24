import { ShoppingPage } from '../../../../features/shopping/page.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return <ShoppingPage id={(await params).id} scope="family" />;
}
