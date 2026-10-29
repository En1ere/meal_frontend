import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import type { draftLegalDocuments } from '../../shared/legal/draft-documents.js';

interface DraftDocumentPageProps {
    document: (typeof draftLegalDocuments)[number];
}

function readDraft(filename: string) {
    const source = path.resolve(process.cwd(), '..', 'docs', 'legal', filename);
    return fs.readFileSync(source, 'utf8');
}

export function DraftDocumentPage({ document }: DraftDocumentPageProps) {
    const draft = readDraft(document.filename);

    return (
        <main id="main" className="draft-legal">
            <nav className="draft-legal-breadcrumbs" aria-label="Правовые документы">
                <Link href="/legal">Все правовые документы</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{document.title}</span>
            </nav>
            <aside className="draft-legal-notice" role="note" aria-label="Статус документа">
                <strong>Предварительный текст — не утверждённая редакция</strong>
                <p>
                    Документ доступен для ознакомления. Значение <code>[Тут будут данные]</code> отмечает сведения,
                    которые появятся после утверждения реквизитов и условий. Юридически значимое принятие этого текста
                    отключено: он не является утверждённой production-редакцией или доказательством согласия.
                </p>
            </aside>
            <article aria-label={document.title}>
                <pre className="draft-legal-content">{draft}</pre>
            </article>
            <p>
                Если документ открыт из формы регистрации, вернитесь в исходную вкладку — введённые данные останутся
                там.
            </p>
            <div className="draft-legal-actions">
                <Link href="/legal">К списку документов</Link>
                <Link href="/auth/sign-up">Открыть новую форму регистрации</Link>
            </div>
        </main>
    );
}
