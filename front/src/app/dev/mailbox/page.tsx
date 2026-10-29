import { notFound } from 'next/navigation';
import { MockMailbox } from '../../../features/auth/mailbox/client.js';
export const metadata = {
    title: 'Тестовая почта',
    robots: { index: false, follow: false },
    referrer: 'no-referrer' as const,
};
export default function Page() {
    if (process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_API_MODE !== 'mock') notFound();
    return <MockMailbox />;
}
