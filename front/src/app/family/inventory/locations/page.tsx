import { InventoryLocationsPage } from '../../../../features/inventory/client.js';
export const metadata = { title: 'Семейные места хранения', robots: { index: false, follow: false } };
export default function Page() {
    return <InventoryLocationsPage scope="family" />;
}
