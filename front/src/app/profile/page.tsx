import { OwnProfilePage } from '../../features/profiles/profile-pages.js';
export const metadata = { title: 'Мой профиль', robots: { index: false, follow: false } };
export default function Page() {
    return <OwnProfilePage />;
}
