import { InventoryHistoryPage } from '../../../../features/inventory/client.js';
export const metadata = { title: 'История семейных запасов', robots: { index: false, follow: false } };
export default function Page() {
    return <InventoryHistoryPage scope="family" />;
}
