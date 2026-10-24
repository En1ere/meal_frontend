import { SignIn } from '../../../features/auth/auth-screen.js';
export const metadata = { title: 'Вход модератора', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
    const params = await searchParams;
    return <SignIn context="moderator" returnTo={params.returnTo} />;
}
