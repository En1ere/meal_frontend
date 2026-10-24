import { HelpPage } from '../../features/public-info/help-page.js';

export const metadata = {
    title: 'Справка — Meal Planner',
    description: 'Инструкции по запасам, OCR, AI, offline-режиму и поддержке Meal Planner.',
};

export default function Page() {
    return <HelpPage />;
}
