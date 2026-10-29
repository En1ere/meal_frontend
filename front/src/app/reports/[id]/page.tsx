import { RecipeReportDetail } from '../../../features/recipes/client.js';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <RecipeReportDetail id={id} />;
}
