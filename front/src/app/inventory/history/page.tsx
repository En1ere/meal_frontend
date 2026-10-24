import { InventoryHistoryPage } from '../../../features/inventory/history-page.js';
export const metadata = { title: 'История запасов', robots: { index: false, follow: false } };
export default function Page() {
    return <InventoryHistoryPage />;
}
