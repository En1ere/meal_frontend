import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';

interface DraftDocumentPageProps {
    filename: string;
    title: string;
}

function readDraft(filename: string) {
    const source = path.resolve(process.cwd(), '..', 'docs', 'legal', filename);
    return fs.readFileSync(source, 'utf8');
}

export function DraftDocumentPage({ filename, title }: DraftDocumentPageProps) {
    const draft = readDraft(filename);

    return (
        <main id="main" className="draft-legal">
            <aside className="draft-legal-notice" role="note" aria-label="Статус документа">
                <strong>Черновик — не опубликованная редакция</strong>
                <p>
                    Документ доступен для ознакомления и согласования. Поля с пометкой <code>[УКАЗАТЬ]</code> ещё не
                    заполнены реальными реквизитами. В тестовом контуре он используется только для проверки интерфейса
                    регистрации и согласий, но не является опубликованной production-редакцией или юридическим
                    доказательством публикации.
                </p>
            </aside>
            <article aria-label={title}>
                <pre className="draft-legal-content">{draft}</pre>
            </article>
            <p>
                Если документ открыт из формы регистрации, вернитесь в исходную вкладку — введённые данные останутся
                там.
            </p>
            <Link href="/auth/sign-up">Открыть новую форму регистрации</Link>
        </main>
    );
}
