import { HelpPage } from '../../features/public-info/client.js';
import { PublicShell } from '../../widgets/public-shell/index.js';

export const metadata = {
    title: 'Справка — Meal Planner',
    description: 'Инструкции по запасам, OCR, AI, offline-режиму и поддержке Meal Planner.',
};

export default function Page() {
    return (
        <PublicShell current="help">
            <HelpPage />
        </PublicShell>
    );
}
