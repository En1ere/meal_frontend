import { OnboardingPage } from '../../features/personalization/client.js';
import { PersonalShell } from '../../widgets/personal-shell/client.js';
export const metadata = { title: 'Начало работы', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <PersonalShell>
            <OnboardingPage />
        </PersonalShell>
    );
}
