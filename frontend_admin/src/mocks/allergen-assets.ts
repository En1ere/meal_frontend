const assets = new Map<string, string>();

export function registerAllergenAsset(checksum: string, dataUrl: string) {
    assets.set(checksum, dataUrl);
}

export function allergenAsset(checksum: string) {
    return assets.get(checksum) ?? null;
}
