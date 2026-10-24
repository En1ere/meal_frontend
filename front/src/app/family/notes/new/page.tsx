import { FamilyNoteEditor } from '../../../../features/family-notes/note-editor.js';
export const metadata = { title: 'Новая семейная заметка', robots: { index: false, follow: false } };
export default function Page() {
    return <FamilyNoteEditor />;
}
