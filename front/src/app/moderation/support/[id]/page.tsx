import { ModerationSupport } from '../../../../features/moderation/moderation.js';
export const metadata = { title: 'Обращение поддержки', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    return <ModerationSupport id={(await params).id} />;
}
