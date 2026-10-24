import { contracts, type Route } from '../shared/api/contracts.generated.js';
export function matchContract(method: string, path: string): { key: Route; params?: Record<string, string> } | null {
    const exact = `${method} ${path}`;
    if (Object.hasOwn(contracts, exact)) return { key: exact as Route };
    const paths = (Object.keys(contracts) as Route[])
        .filter((key) => key.startsWith(`${method} `))
        .sort((a, b) => (a.match(/\{/g)?.length ?? 0) - (b.match(/\{/g)?.length ?? 0));
    for (const key of paths) {
        const template = key.slice(method.length + 1).split('/');
        const actual = path.split('/');
        if (actual.length !== template.length) continue;
        const params: Record<string, string> = {};
        let matches = true;
        for (let i = 0; i < template.length; i++) {
            const part = template[i]!;
            if (part.startsWith('{') && part.endsWith('}')) {
                try {
                    params[part.slice(1, -1)] = decodeURIComponent(actual[i]!);
                } catch {
                    matches = false;
                    break;
                }
            } else if (part !== actual[i]) {
                matches = false;
                break;
            }
        }
        if (matches) return { key, params };
    }
    return null;
}
