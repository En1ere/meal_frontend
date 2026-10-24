import { ModerationItem } from '../../../../features/moderation/moderation.js';
export const metadata = { title: 'Проверка материала', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return <ModerationItem id={(await params).id} />;
}
