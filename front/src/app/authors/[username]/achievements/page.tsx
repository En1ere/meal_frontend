import { PublicAchievementsPage } from '../../../../features/achievements/public-progress.js';

export const metadata = { title: 'Достижения автора' };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    return <PublicAchievementsPage username={username} />;
}
