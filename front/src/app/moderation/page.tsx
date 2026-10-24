import { ModerationOverview } from '../../features/moderation/moderation.js';
export const metadata = { title: 'Модератор', robots: { index: false, follow: false } };
export default function Page() {
    return <ModerationOverview />;
}
