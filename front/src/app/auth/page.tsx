import { SignIn } from '../../features/auth/routes/client.js';
export const metadata = { title: 'Вход', robots: { index: false, follow: false } };
export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ returnTo?: string; notice?: string }>;
}) {
    const params = await searchParams;
    return (
        <>
            <link rel="preload" as="image" href="/assets/auth-cover-720x768.webp" fetchPriority="high" />
            <SignIn returnTo={params.returnTo} notice={params.notice} />
        </>
    );
}
