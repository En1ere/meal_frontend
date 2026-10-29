export type InventoryScope = 'private' | 'family';

export const inventoryScopeQuery = (scope: InventoryScope) => ({ scope });

export const places: Readonly<Record<string, string>> = {
    fridge: 'Холодильник',
    freezer: 'Морозилка',
    cabinet: 'Шкаф',
    pantry: 'Кладовая',
    shelf: 'Полка',
};
