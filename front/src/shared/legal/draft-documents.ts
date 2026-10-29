export interface DraftLegalDocument {
    slug: string;
    title: string;
    filename: string;
    summary: string;
}

export const draftLegalDocuments = [
    {
        slug: 'terms',
        title: 'Пользовательское соглашение и публичная оферта',
        filename: '01-user-agreement-public-offer.md',
        summary: 'Правила использования сервиса, подписки и ответственности сторон.',
    },
    {
        slug: 'privacy',
        title: 'Политика обработки персональных данных',
        filename: '02-personal-data-policy.md',
        summary: 'Категории данных, цели обработки, права пользователя и меры защиты.',
    },
    {
        slug: 'personal-data-consent',
        title: 'Согласие на обработку персональных данных',
        filename: '03-general-pd-consent.md',
        summary: 'Предварительный текст общего согласия на обработку данных.',
    },
    {
        slug: 'special-category-consent',
        title: 'Согласие на обработку специальных категорий данных',
        filename: '04-special-category-consent.md',
        summary: 'Отдельное согласие для сведений о здоровье и связанных данных.',
    },
    {
        slug: 'dissemination-consent',
        title: 'Согласие на распространение персональных данных',
        filename: '05-dissemination-consent.md',
        summary: 'Настройки и ограничения публичного распространения данных.',
    },
    {
        slug: 'ai-consent',
        title: 'Согласие на использование данных AI-функциями',
        filename: '06-ai-processing-consent.md',
        summary: 'Условия передачи выбранного контекста AI-функциям.',
    },
    {
        slug: 'marketing-consent',
        title: 'Согласие на рекламные сообщения',
        filename: '07-marketing-consent.md',
        summary: 'Отдельное добровольное согласие на маркетинговые коммуникации.',
    },
    {
        slug: 'cookies',
        title: 'Уведомление о cookies и локальном хранении',
        filename: '08-cookie-notice.md',
        summary: 'Использование обязательных и необязательных технологий хранения.',
    },
    {
        slug: 'community-rules',
        title: 'Правила сообщества и пользовательского контента',
        filename: '09-community-content-rules.md',
        summary: 'Требования к публикациям, модерации и авторским правам.',
    },
    {
        slug: 'subscription-rules',
        title: 'Правила подписки, оплаты и возвратов',
        filename: '10-subscription-payment-refund-rules.md',
        summary: 'Предварительные условия подписки, списаний и возвратов.',
    },
    {
        slug: 'child-profile-consent',
        title: 'Согласие представителя на профиль ребёнка',
        filename: '11-child-profile-representative-consent.md',
        summary: 'Предварительный текст согласия законного представителя.',
    },
] as const satisfies readonly DraftLegalDocument[];

export type DraftLegalDocumentSlug = (typeof draftLegalDocuments)[number]['slug'];

export function findDraftLegalDocument(slug: string): (typeof draftLegalDocuments)[number] | undefined {
    return draftLegalDocuments.find((document) => document.slug === slug);
}
