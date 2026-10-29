import { NewsDetailPage } from '../../../features/news/client.js';
import { PublicShell } from '../../../widgets/public-shell/index.js';
export const metadata = { title: 'Новость сервиса' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <PublicShell current="news">
            <NewsDetailPage id={id} />
        </PublicShell>
    );
}
