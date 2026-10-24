import Link from 'next/link';
export default function NotFound() {
    return (
        <main id="main" className="status-panel">
            <h1>Рецепт недоступен</h1>
            <p>Рецепт не опубликован, снят с публикации или адрес неверен.</p>
            <Link href="/recipes">Вернуться к рецептам</Link>
        </main>
    );
}
