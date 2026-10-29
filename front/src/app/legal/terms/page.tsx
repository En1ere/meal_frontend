import { DraftDocumentPage } from '../../../features/legal/server.js';
import { findDraftLegalDocument } from '../../../shared/legal/draft-documents.js';
export const metadata = {
    title: 'Условия использования — предварительный текст',
    robots: { index: false, follow: false },
};
export default function Page() {
    return <DraftDocumentPage document={findDraftLegalDocument('terms')!} />;
}
