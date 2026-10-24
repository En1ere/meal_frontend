import { notFound } from 'next/navigation';
import { ModerationQueue } from '../../../../features/moderation/moderation.js';
const queues = new Set(['recipes', 'recipe_variants', 'products', 'reports', 'support', 'authorship']);
export const metadata = { title: 'Очередь модерации', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ queue: string }> }) {
    const { queue } = await params;
    if (!queues.has(queue)) notFound();
    return <ModerationQueue queue={queue} />;
}
