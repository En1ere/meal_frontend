import { UserHome } from '../features/auth/home/client.js';
import { PersonalShell } from '../widgets/personal-shell/client.js';
export const metadata = { title: 'Главная — Meal Planner', robots: { index: false, follow: false } };
export default function Page() {
    return (
        <PersonalShell>
            <UserHome />
        </PersonalShell>
    );
}
