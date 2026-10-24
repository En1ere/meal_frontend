export const recipeTabs = ['for-you', 'inventory', 'new'] as const;
export type RecipeTab = (typeof recipeTabs)[number];
export const detailTabs = ['ingredients', 'steps', 'variants', 'comments'] as const;
export type DetailTab = (typeof detailTabs)[number];
function positive(value: string | null, fallback: number, maximum: number) {
    return value && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= maximum ? Number(value) : fallback;
}
export function catalogState(params: URLSearchParams) {
    const tab = params.get('tab');
    return {
        q: (params.get('q') ?? '').slice(0, 200),
        category: (params.get('category') ?? '').slice(0, 100),
        tab: recipeTabs.find((value) => value === tab) ?? 'for-you',
        page: positive(params.get('page'), 1, 10000),
    };
}
export function detailState(params: URLSearchParams, baseServings: number) {
    return {
        tab: detailTabs.find((value) => value === params.get('tab')) ?? 'ingredients',
        servings: positive(params.get('servings'), baseServings, 1000),
    };
}
export function catalogHref(state: ReturnType<typeof catalogState>) {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category) params.set('category', state.category);
    if (state.tab !== 'for-you') params.set('tab', state.tab);
    if (state.page !== 1) params.set('page', String(state.page));
    return `/recipes${params.size ? `?${params.toString()}` : ''}`;
}
export function safeCatalogReturn(value: string | null) {
    if (value && /^\/authors\/[a-zA-Z0-9_%.-]+$/.test(value)) return value;
    if (value === '/community' || value?.startsWith('/community?')) {
        const source = new URLSearchParams(value.split('?')[1]);
        const params = new URLSearchParams();
        for (const [key, limit] of [
            ['q', 200],
            ['category', 100],
            ['author', 256],
        ] as const) {
            const text = source.get(key)?.slice(0, limit);
            if (text) params.set(key, text);
        }
        if (source.get('sort') === 'oldest') params.set('sort', 'oldest');
        return `/community${params.size ? `?${params}` : ''}`;
    }
    if (!value || (value !== '/recipes' && !value.startsWith('/recipes?'))) return '/recipes';
    return catalogHref(catalogState(new URLSearchParams(value.split('?')[1])));
}
// Decimal proportions preserve source precision without floating-point arithmetic.
export function scaleQuantity(value: string | null, base: number, servings: number): string | null {
    if (value === null) return null;
    const [whole, fraction = ''] = value.split('.');
    const amount = BigInt(whole!) * 100000000n + BigInt(fraction.padEnd(8, '0'));
    const scaled = (amount * BigInt(servings) + BigInt(base) - 1n) / BigInt(base);
    const tail = (scaled % 100000000n).toString().padStart(8, '0').replace(/0+$/, '');
    return `${scaled / 100000000n}${tail ? `.${tail}` : ''}`;
}
