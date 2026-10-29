import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DraftDocumentPage } from '../../../features/legal/server.js';
import { draftLegalDocuments, findDraftLegalDocument } from '../../../shared/legal/draft-documents.js';

export const dynamicParams = false;

export function generateStaticParams() {
    return draftLegalDocuments
        .filter((document) => document.slug !== 'terms' && document.slug !== 'privacy')
        .map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({ params }: PageProps<'/legal/[slug]'>): Promise<Metadata> {
    const { slug } = await params;
    const document = findDraftLegalDocument(slug);
    if (!document) return {};
    return {
        title: `${document.title} — предварительный текст`,
        robots: { index: false, follow: false },
    };
}

export default async function Page({ params }: PageProps<'/legal/[slug]'>) {
    const { slug } = await params;
    const document = findDraftLegalDocument(slug);
    if (!document) notFound();
    return <DraftDocumentPage document={document} />;
}
