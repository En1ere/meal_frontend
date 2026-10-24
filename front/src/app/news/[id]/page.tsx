import { NewsDetailPage } from '../../../features/news/news.js';
export const metadata = { title: 'Новость сервиса' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <NewsDetailPage id={id} />;
}
