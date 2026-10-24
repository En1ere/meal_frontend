export function updateViewUrl(path: string, current: URLSearchParams, changes: Record<string, string | null>): string {
    const query = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
        if (value) query.set(key, value);
        else query.delete(key);
    }
    return `${path}${query.size ? `?${query.toString()}` : ''}`;
}

export function productView(query: URLSearchParams, variants: { id: string; products: { id: string }[] }[]) {
    const variant = variants.find((item) => item.id === query.get('variant'));
    const sku = variant?.products.find((item) => item.id === query.get('sku'));
    const requestedTab = query.get('tab');
    return {
        variantId: variant?.id ?? '',
        skuId: sku?.id ?? '',
        tab:
            requestedTab && ['about', 'nutrition', 'allergens', 'source'].includes(requestedTab)
                ? requestedTab
                : 'about',
    };
}
