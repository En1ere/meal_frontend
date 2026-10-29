import { AccountLifecyclePage } from '../../../../features/account-lifecycle/client.js';
import { PersonalShell } from '../../../../widgets/personal-shell/client.js';

export const metadata = { title: 'Управление аккаунтом' };

export default function Page() {
    return (
        <PersonalShell>
            <AccountLifecyclePage />
        </PersonalShell>
    );
}
