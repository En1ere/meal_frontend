import { PublicProfilePage } from '../../../features/profiles/profile-pages.js';
export const metadata = { title: 'Профиль автора' };
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    return <PublicProfilePage username={username} />;
}
