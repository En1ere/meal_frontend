import { MfaScreen } from '../../../features/auth/routes/client.js';
export const metadata = { title: 'Проверка входа', robots: { index: false, follow: false } };
export default function Page() {
    return <MfaScreen context="moderator" />;
}
