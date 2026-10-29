import { FinanceExpenseDetailPage } from '../../../../../features/finance/client.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <FinanceExpenseDetailPage id={id} />;
}
