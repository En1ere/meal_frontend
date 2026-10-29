import { PricingPage } from '../../features/public-info/client.js';
import { PublicShell } from '../../widgets/public-shell/index.js';

export const metadata = {
    title: 'Тарифы — Meal Planner',
    description: 'Сравнение тарифов Free и Plus и пакета AI-действий Meal Planner.',
};

export default function Page() {
    return (
        <PublicShell current="pricing">
            <PricingPage />
        </PublicShell>
    );
}
