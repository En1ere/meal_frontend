import { Link } from 'react-router-dom';
export default function NotFound() {
    return (
        <main id="main" className="status-panel">
            <h1>Страница не найдена</h1>
            <p>Проверьте адрес или вернитесь к началу.</p>
            <Link to="/">Открыть администрирование</Link>
        </main>
    );
}
