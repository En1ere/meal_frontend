import { OwnershipRequestPage } from '../../../../../../features/family/ownership/client.js';
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return <OwnershipRequestPage token={token} />;
}
