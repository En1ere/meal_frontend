import { NewsPage } from '../../features/news/client.js';
import { PublicShell } from '../../widgets/public-shell/index.js';
export const metadata = { title: 'Новости сервиса' };
export default function Page() {
    return (
        <PublicShell current="news">
            <NewsPage />
        </PublicShell>
    );
}
