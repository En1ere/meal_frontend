import Link from 'next/link';
import { draftLegalDocuments } from '../../shared/legal/draft-documents.js';

export const metadata = {
    title: 'Правовые документы — предварительные тексты',
    robots: { index: false, follow: false },
};

export default function Page() {
    return (
        <main id="main" className="draft-legal legal-catalog">
            <header>
                <p className="eyebrow">Правовая информация</p>
                <h1>Предварительные тексты документов</h1>
                <p className="legal-catalog-intro">
                    Эти материалы опубликованы для ознакомления с планируемыми правилами сервиса. Они содержат заглушки,
                    не являются утверждёнными редакциями и не используются для юридически значимого принятия.
                </p>
            </header>
            <aside className="draft-legal-notice" role="note" aria-label="Статус пакета документов">
                <strong>Пакет находится в статусе draft_blocked</strong>
                <p>
                    Поля <code>[Тут будут данные]</code> будут заполнены после утверждения реквизитов, контактов,
                    провайдеров и сроков обработки. Регистрация и согласия не должны считать эти страницы опубликованной
                    юридической редакцией.
                </p>
            </aside>
            <ul className="legal-catalog-list">
                {draftLegalDocuments.map((document) => (
                    <li key={document.slug}>
                        <Link href={`/legal/${document.slug}`}>{document.title}</Link>
                        <p>{document.summary}</p>
                    </li>
                ))}
            </ul>
        </main>
    );
}
