import { FamilyNoteEditor } from '../../../../../features/family-notes/note-editor.js';
export const metadata = { title: 'Редактор семейной заметки', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <FamilyNoteEditor id={id} />;
}
