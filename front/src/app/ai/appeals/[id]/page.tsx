import { AiAppealDetailPage } from '../../../../features/ai-appeals/ai-appeals.js';

export const metadata = { title: 'AI-апелляция', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <AiAppealDetailPage id={id} />;
}
