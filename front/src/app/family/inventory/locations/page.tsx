import { InventoryLocationsPage } from '../../../../features/inventory/locations-page.js';
export const metadata = { title: 'Семейные места хранения', robots: { index: false, follow: false } };
export default function Page() {
    return <InventoryLocationsPage scope="family" />;
}
