import { AccountPage } from '../../../widgets/account-security/client.js';
import { PersonalShell } from '../../../widgets/personal-shell/client.js';
export const metadata = { title: 'Аккаунт и безопасность', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <PersonalShell>
            <AccountPage />
        </PersonalShell>
    );
}
