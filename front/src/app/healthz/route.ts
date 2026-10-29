export const dynamic = 'force-dynamic';

export function GET() {
    return Response.json(
        {
            status: 'ok',
            service: 'meal-frontend',
            version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
        },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
