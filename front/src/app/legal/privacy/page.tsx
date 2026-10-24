import { DraftDocumentPage } from '../../../features/legal/draft-document-page.js';
export const metadata = {
    title: 'Политика конфиденциальности — черновик',
    robots: { index: false, follow: false },
};
export default function Page() {
    return <DraftDocumentPage filename="02-personal-data-policy.md" title="Политика конфиденциальности" />;
}
