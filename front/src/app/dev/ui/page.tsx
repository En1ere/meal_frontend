import { notFound } from 'next/navigation';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
export default function Page() {
    if (process.env.NODE_ENV !== 'development') notFound();
    return (
        <main id="main">
            <section className="status-panel">
                <h1>Loading primitives</h1>
                <div data-testid="block">
                    <ArcSkeleton height="3em" />
                </div>
                <div data-testid="lines">
                    <ArcSkeleton variant="lines" lines={4} height="0.8em" gap="0.5em" lastLineWidth="55%" />
                </div>
                <div data-testid="invalid-lines">
                    <ArcSkeleton variant="lines" lines={-1} label={null} />
                </div>
                <button disabled aria-busy="true" className="button primary">
                    <ArcInlineLoader label={null} />
                    Сохраняем…
                </button>
                <ArcInlineLoader label="Загрузка примера" />
            </section>
            <ArcPageLoader />
        </main>
    );
}
