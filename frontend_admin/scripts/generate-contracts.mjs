import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { format } from 'prettier';

const root = new URL('../', import.meta.url);
const documentBytes = fs.readFileSync(new URL('contracts/openapi.json', root));
const document = JSON.parse(documentBytes);
const hash = createHash('sha256').update(documentBytes).digest('hex');
const includedPath = (path) =>
    path.startsWith('/api/v1/admin/') ||
    path.startsWith('/api/v1/staff/') ||
    path.startsWith('/api/v1/auth/') ||
    path.startsWith('/health/') ||
    path === '/api/v1/recipe-policy';
// A deliberately bounded generator: reject new schema constructs instead of silently weakening validation.
function schema(s) {
    if (Object.keys(s).length === 0) return 'z.unknown()';
    const supported = [
        'type',
        'properties',
        'required',
        'additionalProperties',
        'enum',
        'nullable',
        'items',
        'minLength',
        'maxLength',
        'pattern',
        'format',
        'minimum',
        'maximum',
        'exclusiveMinimum',
        'exclusiveMaximum',
        'default',
        'minItems',
        'maxItems',
        'anyOf',
        'oneOf',
    ];
    for (const key of Object.keys(s)) if (!supported.includes(key)) throw Error(`Unsupported OpenAPI keyword: ${key}`);
    let result;
    if (s.anyOf || s.oneOf) {
        const branches = s.anyOf ?? s.oneOf;
        result = `z.union([${branches.map(schema).join(',')}])`;
        if (s.oneOf)
            result += `.refine(value => [${branches.map(schema).join(',')}].filter(branch => branch.safeParse(value).success).length === 1)`;
    } else if (s.enum) {
        const literals = s.enum.map((v) => (v === null ? 'z.null()' : `z.literal(${JSON.stringify(v)})`));
        result = literals.length === 1 ? literals[0] : `z.union([${literals.join(',')}])`;
    } else if (s.type === 'object') {
        if (typeof s.additionalProperties === 'object' && !s.properties)
            result = `z.record(z.string(),${schema(s.additionalProperties)})`;
        else {
            if (s.additionalProperties !== false) throw Error('Only strict objects supported');
            result = `z.strictObject({${Object.entries(s.properties ?? {})
                .map(
                    ([key, value]) =>
                        `${JSON.stringify(key)}:${schema(value)}${s.required?.includes(key) ? '' : '.optional()'}`,
                )
                .join(',')}})`;
        }
    } else if (s.type === 'array') {
        result = `z.array(${schema(s.items)})`;
        if (s.minItems !== undefined) result += `.min(${s.minItems})`;
        if (s.maxItems !== undefined) result += `.max(${s.maxItems})`;
    } else if (s.type === 'string') {
        result = 'z.string()';
        if (s.minLength !== undefined) result += `.min(${s.minLength})`;
        if (s.maxLength !== undefined) result += `.max(${s.maxLength})`;
        if (s.pattern) result += `.regex(new RegExp(${JSON.stringify(s.pattern)}, 'u'))`;
        if (s.format && !['email', 'date-time', 'date', 'uuid', 'uri'].includes(s.format))
            throw Error('Unsupported string format');
        if (s.format === 'date') result += '.pipe(z.iso.date())';
        if (s.format === 'uri') result += '.pipe(z.url())';
        if (s.format === 'email') result += '.pipe(z.email())';
        if (s.format === 'date-time') result += '.pipe(z.iso.datetime())';
        if (s.format === 'uuid') result += '.pipe(z.uuid())';
    } else if (s.type === 'number' || s.type === 'integer') {
        result = s.type === 'integer' ? 'z.number().int()' : 'z.number()';
        if (s.minimum !== undefined) result += `.${s.exclusiveMinimum ? 'gt' : 'min'}(${s.minimum})`;
        if (s.maximum !== undefined) result += `.${s.exclusiveMaximum ? 'lt' : 'max'}(${s.maximum})`;
    } else if (s.type === 'boolean') result = 'z.boolean()';
    else throw Error(`Unsupported schema type: ${s.type}`);
    return (
        result +
        (s.nullable && !s.enum?.includes(null) ? '.nullable()' : '') +
        (Object.hasOwn(s, 'default') ? `.default(${JSON.stringify(s.default)})` : '')
    );
}
const entries = [];
for (const [path, item] of Object.entries(document.paths))
    for (const [method, operation] of Object.entries(item)) {
        if (!['get', 'post', 'put', 'patch'].includes(method))
            throw Error('Review new HTTP method before generating mocks');
        if (!includedPath(path)) continue;
        const request = operation.requestBody?.content['application/json']?.schema;
        const pathParameters = operation.parameters?.filter((parameter) => parameter.in === 'path') ?? [];
        const params = pathParameters.length
            ? `z.strictObject({${pathParameters.map((parameter) => `${JSON.stringify(parameter.name)}:${schema(parameter.schema)}`).join(',')}})`
            : 'null';
        entries.push(
            `${JSON.stringify(`${method.toUpperCase()} ${path}`)}:{params:${params},request:${request ? schema(request) : 'null'},success:${schema((operation.responses['200'] ?? operation.responses['201']).content['application/json'].schema)}}`,
        );
    }
const error = Object.values(document.paths)
    .flatMap((item) => Object.values(item))
    .find((operation) => operation.responses?.['401'])?.responses['401'].content['application/json'].schema;
if (!error) throw Error('OpenAPI has no common 401 error schema');
const source = await format(
    `// Generated from contracts/openapi.json. Do not edit. SHA256: ${hash}
import { z } from 'zod';
export const contractVersion = ${JSON.stringify(document.info.version)};
export const contracts = {${entries.join(',')}};
export const errorSchema = ${schema(error)};
export type Route = keyof typeof contracts;
export type Success<R extends Route> = z.infer<(typeof contracts)[R]['success']>;
export type Principal = Success<'GET /api/v1/auth/me'>['data']['user'];
`,
    { parser: 'typescript', ...JSON.parse(fs.readFileSync(new URL('.prettierrc.json', root), 'utf8')) },
);
const output = new URL('src/shared/api/contracts.generated.ts', root);
if (process.argv.includes('--check')) {
    if (fs.readFileSync(output, 'utf8').replaceAll('\r\n', '\n') !== source)
        throw Error('Generated contracts are stale');
} else {
    fs.mkdirSync(new URL('src/shared/api/', root), { recursive: true });
    fs.writeFileSync(output, source);
}
console.log(`OpenAPI ${document.info.version}: ${entries.length} operations checked`);
