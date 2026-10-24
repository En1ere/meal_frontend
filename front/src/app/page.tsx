import { UserHome } from '../features/auth/user-home.js';
export const metadata = { title: 'Главная — Meal Planner', robots: { index: false, follow: false } };
export default function Page() {
    return <UserHome />;
}
