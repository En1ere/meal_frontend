import type { Success } from '../../shared/api/contracts.generated.js';
export type Preserve = Success<'GET /api/v1/preserves/{id}'>['data']['preserve'];
export const preserveTypes = {
    canned: 'Консервы',
    jam: 'Варенье и джемы',
    frozen: 'Заморозка',
    dried: 'Сушёные заготовки',
    fermented: 'Соленья и квашение',
    infusion: 'Настойки',
    meat: 'Мясные заготовки',
    cheese: 'Сыры',
    other: 'Другое',
};
