import { AccountPage } from '../../../widgets/account-security/client.js';
import { SessionGuard } from '../../../widgets/session-guard/client.js';
export const metadata = { title: 'Аккаунт и безопасность', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <SessionGuard context="user">
            <AccountPage />
        </SessionGuard>
    );
}
