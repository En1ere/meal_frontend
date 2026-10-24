import { DraftDocumentPage } from '../../../features/legal/draft-document-page.js';
export const metadata = {
    title: 'Условия использования — черновик',
    robots: { index: false, follow: false },
};
export default function Page() {
    return <DraftDocumentPage filename="01-user-agreement-public-offer.md" title="Условия использования" />;
}
