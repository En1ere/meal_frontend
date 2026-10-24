import Link from 'next/link';

export default function NotFound() {
    return (
        <main id="main" className="status-panel">
            <p>Ошибка 404</p>
            <h1>Очередь модерации не найдена</h1>
            <p>Проверьте адрес или вернитесь к списку доступных очередей.</p>
            <Link href="/moderation">К сводке модератора</Link>
        </main>
    );
}
