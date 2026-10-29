import { PublicReputationPage } from '../../../../features/achievements/client.js';
import { PublicShell } from '../../../../widgets/public-shell/index.js';

export const metadata = { title: 'Репутация автора' };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    return (
        <PublicShell current="community">
            <PublicReputationPage username={username} />
        </PublicShell>
    );
}
