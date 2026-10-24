import { FamilyNoteDetail } from '../../../../features/family-notes/note-detail.js';
export const metadata = { title: 'Семейная заметка', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <FamilyNoteDetail id={id} />;
}
