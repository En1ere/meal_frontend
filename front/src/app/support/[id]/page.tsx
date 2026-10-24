import { SupportDetail } from '../../../features/support/support.js';
export const metadata = { title: 'Обращение', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <SupportDetail id={id} />;
}
