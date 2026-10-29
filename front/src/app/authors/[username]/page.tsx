import { PublicProfilePage } from '../../../widgets/profile-pages/client.js';
import { PublicShell } from '../../../widgets/public-shell/index.js';
export const metadata = { title: 'Профиль автора' };
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    return (
        <PublicShell current="community">
            <PublicProfilePage username={username} />
        </PublicShell>
    );
}
