import { PublicReputationPage } from '../../../../features/achievements/public-progress.js';

export const metadata = { title: 'Репутация автора' };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    return <PublicReputationPage username={username} />;
}
