// Generated from contracts/openapi.json. Do not edit. SHA256: 196bd14fd95263ee0b44ed4e140d12cd1e0b93cb88c52fb171ed5eeb631c78b9
import { z } from 'zod';
export const contractVersion = '0.0.60';
export const contracts = {
    'GET /api/v1/recipe-policy': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                version: z.number().int().gt(0).max(9007199254740991),
                submissionDailyLimit: z.number().int().min(1).max(10000),
                commentHourlyLimit: z.number().int().min(1).max(10000),
                reportDailyLimit: z.number().int().min(1).max(10000),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/settings/recipe-policy': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                version: z.number().int().gt(0).max(9007199254740991),
                submissionDailyLimit: z.number().int().min(1).max(10000),
                commentHourlyLimit: z.number().int().min(1).max(10000),
                reportDailyLimit: z.number().int().min(1).max(10000),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'PUT /api/v1/admin/settings/recipe-policy': {
        params: null,
        request: z.strictObject({
            submissionDailyLimit: z.number().int().min(1).max(10000),
            commentHourlyLimit: z.number().int().min(1).max(10000),
            reportDailyLimit: z.number().int().min(1).max(10000),
            expectedVersion: z.number().int().gt(0).max(9007199254740991),
        }),
        success: z.strictObject({
            data: z.strictObject({
                version: z.number().int().gt(0).max(9007199254740991),
                submissionDailyLimit: z.number().int().min(1).max(10000),
                commentHourlyLimit: z.number().int().min(1).max(10000),
                reportDailyLimit: z.number().int().min(1).max(10000),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/free-ai/users/{id}': {
        params: z.strictObject({ id: z.string().pipe(z.uuid()) }),
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    login: z.string(),
                    displayName: z.string(),
                    status: z.string(),
                    version: z.string().regex(new RegExp('^[1-9][0-9]*$', 'u')),
                }),
                buckets: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        kind: z.union([
                            z.literal('subscription'),
                            z.literal('transferred'),
                            z.literal('family_reserve'),
                            z.literal('purchased'),
                            z.literal('trial'),
                        ]),
                        granted: z.number().int().min(0).max(9007199254740991),
                        balance: z.number().int().min(0).max(9007199254740991),
                        reserved: z.number().int().min(0).max(9007199254740991),
                        available: z.number().int().min(0).max(9007199254740991),
                        requiresConfirmation: z.boolean(),
                        expiresAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                    }),
                ),
                total: z.number().int().min(0).max(9007199254740991),
                reserved: z.number().int().min(0).max(9007199254740991),
                available: z.number().int().min(0).max(9007199254740991),
                recentOperations: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        taskId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        status: z.string(),
                        cost: z.number().int().min(0).max(9007199254740991),
                        createdAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/free-ai/users/{id}/grants': {
        params: z.strictObject({ id: z.string().pipe(z.uuid()) }),
        request: z.strictObject({
            expectedUserVersion: z.string().regex(new RegExp('^[1-9][0-9]*$', 'u')),
            actions: z.number().int().min(1).max(10000),
            expiresAt: z
                .string()
                .regex(
                    new RegExp(
                        '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                        'u',
                    ),
                )
                .pipe(z.iso.datetime())
                .nullable(),
            reason: z.string().min(1).max(2000),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            confirmed: z.literal(true),
        }),
        success: z.strictObject({
            data: z.strictObject({
                bucketId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                granted: z.number().int().gt(0).max(9007199254740991),
                balance: z.number().int().gt(0).max(9007199254740991),
                expiresAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/allergens': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        code: z.string(),
                        name: z.string(),
                        version: z.number().int().gt(0).max(9007199254740991),
                        activeMappings: z.number().int().min(0).max(9007199254740991),
                        ingredientMappings: z.number().int().min(0).max(9007199254740991),
                        variantMappings: z.number().int().min(0).max(9007199254740991),
                        productMappings: z.number().int().min(0).max(9007199254740991),
                        icon: z.strictObject({
                            state: z.union([z.literal('fallback'), z.literal('custom'), z.literal('unavailable')]),
                            url: z.string().nullable(),
                            fallbackKey: z.string().min(1).max(80),
                            alt: z.string().min(1).max(160),
                        }),
                    }),
                ),
                total: z.number().int().min(0).max(9007199254740991),
                limit: z.number().int().gt(0).max(9007199254740991),
                offset: z.number().int().min(0).max(9007199254740991),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/allergens/subjects': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        subjectType: z.union([z.literal('ingredient'), z.literal('variant'), z.literal('product')]),
                        subjectId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        subjectName: z.string(),
                        imageUrl: z.string().pipe(z.url()).nullable(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/allergens/{code}': {
        params: z.strictObject({ code: z.string().min(1).max(80) }),
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                code: z.string(),
                name: z.string(),
                version: z.number().int().gt(0).max(9007199254740991),
                activeMappings: z.number().int().min(0).max(9007199254740991),
                ingredientMappings: z.number().int().min(0).max(9007199254740991),
                variantMappings: z.number().int().min(0).max(9007199254740991),
                productMappings: z.number().int().min(0).max(9007199254740991),
                icon: z.strictObject({
                    state: z.union([z.literal('fallback'), z.literal('custom'), z.literal('unavailable')]),
                    url: z.string().nullable(),
                    fallbackKey: z.string().min(1).max(80),
                    alt: z.string().min(1).max(160),
                }),
                mappings: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        subjectType: z.union([z.literal('ingredient'), z.literal('variant'), z.literal('product')]),
                        subjectId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        subjectName: z.string(),
                        status: z.union([z.literal('contains'), z.literal('may_contain'), z.literal('unknown')]),
                        source: z.string(),
                        version: z.number().int().gt(0).max(9007199254740991),
                    }),
                ),
                iconUpload: z.strictObject({ mode: z.literal('unavailable'), reason: z.string() }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/allergens/{code}/mappings': {
        params: z.strictObject({ code: z.string() }),
        request: z.strictObject({
            action: z.union([z.literal('add'), z.literal('remove')]),
            subjectType: z.union([z.literal('ingredient'), z.literal('variant'), z.literal('product')]),
            subjectId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            status: z
                .union([z.literal('contains'), z.literal('may_contain'), z.literal('unknown')])
                .default('contains')
                .optional(),
            source: z.string().min(1).max(500),
            mappingId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid())
                .nullable()
                .default(null)
                .optional(),
            expectedVersion: z.number().int().gt(0).max(9007199254740991),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                code: z.string(),
                name: z.string(),
                version: z.number().int().gt(0).max(9007199254740991),
                activeMappings: z.number().int().min(0).max(9007199254740991),
                ingredientMappings: z.number().int().min(0).max(9007199254740991),
                variantMappings: z.number().int().min(0).max(9007199254740991),
                productMappings: z.number().int().min(0).max(9007199254740991),
                icon: z.strictObject({
                    state: z.union([z.literal('fallback'), z.literal('custom'), z.literal('unavailable')]),
                    url: z.string().nullable(),
                    fallbackKey: z.string().min(1).max(80),
                    alt: z.string().min(1).max(160),
                }),
                mappings: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        subjectType: z.union([z.literal('ingredient'), z.literal('variant'), z.literal('product')]),
                        subjectId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        subjectName: z.string(),
                        status: z.union([z.literal('contains'), z.literal('may_contain'), z.literal('unknown')]),
                        source: z.string(),
                        version: z.number().int().gt(0).max(9007199254740991),
                    }),
                ),
                iconUpload: z.strictObject({ mode: z.literal('unavailable'), reason: z.string() }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'PUT /api/v1/admin/allergens/{code}/icon': {
        params: z.strictObject({ code: z.string() }),
        request: z.strictObject({
            action: z.union([z.literal('set_fallback'), z.literal('remove')]),
            fallbackKey: z.string().min(1).max(80),
            altText: z.string().min(1).max(160),
            expectedVersion: z.number().int().gt(0).max(9007199254740991),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                code: z.string(),
                name: z.string(),
                version: z.number().int().gt(0).max(9007199254740991),
                activeMappings: z.number().int().min(0).max(9007199254740991),
                ingredientMappings: z.number().int().min(0).max(9007199254740991),
                variantMappings: z.number().int().min(0).max(9007199254740991),
                productMappings: z.number().int().min(0).max(9007199254740991),
                icon: z.strictObject({
                    state: z.union([z.literal('fallback'), z.literal('custom'), z.literal('unavailable')]),
                    url: z.string().nullable(),
                    fallbackKey: z.string().min(1).max(80),
                    alt: z.string().min(1).max(160),
                }),
                mappings: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        subjectType: z.union([z.literal('ingredient'), z.literal('variant'), z.literal('product')]),
                        subjectId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        subjectName: z.string(),
                        status: z.union([z.literal('contains'), z.literal('may_contain'), z.literal('unknown')]),
                        source: z.string(),
                        version: z.number().int().gt(0).max(9007199254740991),
                    }),
                ),
                iconUpload: z.strictObject({ mode: z.literal('unavailable'), reason: z.string() }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/allergens/{code}/icon/upload': {
        params: z.strictObject({ code: z.string().min(1).max(80) }),
        request: z.strictObject({
            name: z.string().min(1).max(255),
            mime: z.union([z.literal('image/svg+xml'), z.literal('image/png'), z.literal('image/webp')]),
            size: z.number().int().min(1).max(1048576),
            checksumSha256: z.string().regex(new RegExp('^[a-f0-9]{64}$', 'u')),
            altText: z.string().min(1).max(160),
            expectedVersion: z.number().int().gt(0).max(9007199254740991),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                code: z.string(),
                name: z.string(),
                version: z.number().int().gt(0).max(9007199254740991),
                activeMappings: z.number().int().min(0).max(9007199254740991),
                ingredientMappings: z.number().int().min(0).max(9007199254740991),
                variantMappings: z.number().int().min(0).max(9007199254740991),
                productMappings: z.number().int().min(0).max(9007199254740991),
                icon: z.strictObject({
                    state: z.union([z.literal('fallback'), z.literal('custom'), z.literal('unavailable')]),
                    url: z.string().nullable(),
                    fallbackKey: z.string().min(1).max(80),
                    alt: z.string().min(1).max(160),
                }),
                mappings: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        subjectType: z.union([z.literal('ingredient'), z.literal('variant'), z.literal('product')]),
                        subjectId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        subjectName: z.string(),
                        status: z.union([z.literal('contains'), z.literal('may_contain'), z.literal('unknown')]),
                        source: z.string(),
                        version: z.number().int().gt(0).max(9007199254740991),
                    }),
                ),
                iconUpload: z.strictObject({ mode: z.literal('unavailable'), reason: z.string() }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/news-workspace': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        content: z.strictObject({
                            type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                            title: z.string().min(1).max(200),
                            pages: z
                                .array(
                                    z.strictObject({
                                        blocks: z
                                            .array(
                                                z
                                                    .union([
                                                        z.strictObject({
                                                            kind: z.literal('text'),
                                                            text: z.string().min(1).max(10000),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('image'),
                                                            url: z.string().pipe(z.url()),
                                                            alt: z.string().min(1).max(300),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('link'),
                                                            url: z.string().pipe(z.url()),
                                                            text: z.string().min(1).max(300),
                                                        }),
                                                    ])
                                                    .refine(
                                                        (value) =>
                                                            [
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ].filter((branch) => branch.safeParse(value).success)
                                                                .length === 1,
                                                    ),
                                            )
                                            .min(1)
                                            .max(30),
                                    }),
                                )
                                .min(1)
                                .max(10),
                            sources: z
                                .array(
                                    z.strictObject({
                                        claim: z.string().min(1).max(500),
                                        source: z.string().min(1).max(10000),
                                    }),
                                )
                                .max(30),
                            audience: z.strictObject({
                                plans: z
                                    .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                    .max(3),
                                genders: z
                                    .array(z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]))
                                    .max(3),
                                families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                registeredFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                registeredTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                            }),
                            channels: z
                                .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                .min(1)
                                .max(3),
                            category: z.union([z.literal('service'), z.literal('marketing')]),
                        }),
                        status: z.union([
                            z.literal('draft'),
                            z.literal('scheduled'),
                            z.literal('published'),
                            z.literal('cancelled'),
                        ]),
                        scheduledAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        history: z.array(
                            z.strictObject({
                                version: z.number().int().min(-9007199254740991).max(9007199254740991),
                                at: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                                content: z.strictObject({
                                    type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                                    title: z.string().min(1).max(200),
                                    pages: z
                                        .array(
                                            z.strictObject({
                                                blocks: z
                                                    .array(
                                                        z
                                                            .union([
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ])
                                                            .refine(
                                                                (value) =>
                                                                    [
                                                                        z.strictObject({
                                                                            kind: z.literal('text'),
                                                                            text: z.string().min(1).max(10000),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('image'),
                                                                            url: z.string().pipe(z.url()),
                                                                            alt: z.string().min(1).max(300),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('link'),
                                                                            url: z.string().pipe(z.url()),
                                                                            text: z.string().min(1).max(300),
                                                                        }),
                                                                    ].filter(
                                                                        (branch) => branch.safeParse(value).success,
                                                                    ).length === 1,
                                                            ),
                                                    )
                                                    .min(1)
                                                    .max(30),
                                            }),
                                        )
                                        .min(1)
                                        .max(10),
                                    sources: z
                                        .array(
                                            z.strictObject({
                                                claim: z.string().min(1).max(500),
                                                source: z.string().min(1).max(10000),
                                            }),
                                        )
                                        .max(30),
                                    audience: z.strictObject({
                                        plans: z
                                            .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                            .max(3),
                                        genders: z
                                            .array(
                                                z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]),
                                            )
                                            .max(3),
                                        families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                        registeredFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        registeredTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                    }),
                                    channels: z
                                        .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                        .min(1)
                                        .max(3),
                                    category: z.union([z.literal('service'), z.literal('marketing')]),
                                }),
                            }),
                        ),
                    }),
                ),
                preview: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().min(-9007199254740991).max(9007199254740991),
                        recipients: z.number().int().min(0).max(9007199254740991),
                        preliminary: z.literal(true),
                        mock: z.boolean(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/news-workspace/save': {
        params: null,
        request: z.strictObject({
            action: z.literal('save'),
            id: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            version: z.number().int().min(0).max(9007199254740991),
            content: z.strictObject({
                type: z
                    .union([z.literal('article'), z.literal('important')])
                    .default('article')
                    .optional(),
                title: z.string().min(1).max(200),
                pages: z
                    .array(
                        z.strictObject({
                            blocks: z
                                .array(
                                    z
                                        .union([
                                            z.strictObject({
                                                kind: z.literal('text'),
                                                text: z.string().min(1).max(10000),
                                            }),
                                            z.strictObject({
                                                kind: z.literal('image'),
                                                url: z.string().pipe(z.url()),
                                                alt: z.string().min(1).max(300),
                                            }),
                                            z.strictObject({
                                                kind: z.literal('link'),
                                                url: z.string().pipe(z.url()),
                                                text: z.string().min(1).max(300),
                                            }),
                                        ])
                                        .refine(
                                            (value) =>
                                                [
                                                    z.strictObject({
                                                        kind: z.literal('text'),
                                                        text: z.string().min(1).max(10000),
                                                    }),
                                                    z.strictObject({
                                                        kind: z.literal('image'),
                                                        url: z.string().pipe(z.url()),
                                                        alt: z.string().min(1).max(300),
                                                    }),
                                                    z.strictObject({
                                                        kind: z.literal('link'),
                                                        url: z.string().pipe(z.url()),
                                                        text: z.string().min(1).max(300),
                                                    }),
                                                ].filter((branch) => branch.safeParse(value).success).length === 1,
                                        ),
                                )
                                .min(1)
                                .max(30),
                        }),
                    )
                    .min(1)
                    .max(10),
                sources: z
                    .array(z.strictObject({ claim: z.string().min(1).max(500), source: z.string().min(1).max(10000) }))
                    .max(30),
                audience: z.strictObject({
                    plans: z.array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')])).max(3),
                    genders: z.array(z.union([z.literal('female'), z.literal('male'), z.literal('unknown')])).max(3),
                    families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                    registeredFrom: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime())
                        .nullable(),
                    registeredTo: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime())
                        .nullable(),
                    activeFrom: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime())
                        .nullable(),
                    activeTo: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime())
                        .nullable(),
                }),
                channels: z
                    .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                    .min(1)
                    .max(3),
                category: z.union([z.literal('service'), z.literal('marketing')]),
            }),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        content: z.strictObject({
                            type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                            title: z.string().min(1).max(200),
                            pages: z
                                .array(
                                    z.strictObject({
                                        blocks: z
                                            .array(
                                                z
                                                    .union([
                                                        z.strictObject({
                                                            kind: z.literal('text'),
                                                            text: z.string().min(1).max(10000),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('image'),
                                                            url: z.string().pipe(z.url()),
                                                            alt: z.string().min(1).max(300),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('link'),
                                                            url: z.string().pipe(z.url()),
                                                            text: z.string().min(1).max(300),
                                                        }),
                                                    ])
                                                    .refine(
                                                        (value) =>
                                                            [
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ].filter((branch) => branch.safeParse(value).success)
                                                                .length === 1,
                                                    ),
                                            )
                                            .min(1)
                                            .max(30),
                                    }),
                                )
                                .min(1)
                                .max(10),
                            sources: z
                                .array(
                                    z.strictObject({
                                        claim: z.string().min(1).max(500),
                                        source: z.string().min(1).max(10000),
                                    }),
                                )
                                .max(30),
                            audience: z.strictObject({
                                plans: z
                                    .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                    .max(3),
                                genders: z
                                    .array(z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]))
                                    .max(3),
                                families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                registeredFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                registeredTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                            }),
                            channels: z
                                .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                .min(1)
                                .max(3),
                            category: z.union([z.literal('service'), z.literal('marketing')]),
                        }),
                        status: z.union([
                            z.literal('draft'),
                            z.literal('scheduled'),
                            z.literal('published'),
                            z.literal('cancelled'),
                        ]),
                        scheduledAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        history: z.array(
                            z.strictObject({
                                version: z.number().int().min(-9007199254740991).max(9007199254740991),
                                at: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                                content: z.strictObject({
                                    type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                                    title: z.string().min(1).max(200),
                                    pages: z
                                        .array(
                                            z.strictObject({
                                                blocks: z
                                                    .array(
                                                        z
                                                            .union([
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ])
                                                            .refine(
                                                                (value) =>
                                                                    [
                                                                        z.strictObject({
                                                                            kind: z.literal('text'),
                                                                            text: z.string().min(1).max(10000),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('image'),
                                                                            url: z.string().pipe(z.url()),
                                                                            alt: z.string().min(1).max(300),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('link'),
                                                                            url: z.string().pipe(z.url()),
                                                                            text: z.string().min(1).max(300),
                                                                        }),
                                                                    ].filter(
                                                                        (branch) => branch.safeParse(value).success,
                                                                    ).length === 1,
                                                            ),
                                                    )
                                                    .min(1)
                                                    .max(30),
                                            }),
                                        )
                                        .min(1)
                                        .max(10),
                                    sources: z
                                        .array(
                                            z.strictObject({
                                                claim: z.string().min(1).max(500),
                                                source: z.string().min(1).max(10000),
                                            }),
                                        )
                                        .max(30),
                                    audience: z.strictObject({
                                        plans: z
                                            .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                            .max(3),
                                        genders: z
                                            .array(
                                                z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]),
                                            )
                                            .max(3),
                                        families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                        registeredFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        registeredTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                    }),
                                    channels: z
                                        .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                        .min(1)
                                        .max(3),
                                    category: z.union([z.literal('service'), z.literal('marketing')]),
                                }),
                            }),
                        ),
                    }),
                ),
                preview: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().min(-9007199254740991).max(9007199254740991),
                        recipients: z.number().int().min(0).max(9007199254740991),
                        preliminary: z.literal(true),
                        mock: z.boolean(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/news-workspace/preview': {
        params: null,
        request: z.strictObject({
            action: z.literal('preview'),
            id: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            version: z.number().int().gt(0).max(9007199254740991),
        }),
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        content: z.strictObject({
                            type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                            title: z.string().min(1).max(200),
                            pages: z
                                .array(
                                    z.strictObject({
                                        blocks: z
                                            .array(
                                                z
                                                    .union([
                                                        z.strictObject({
                                                            kind: z.literal('text'),
                                                            text: z.string().min(1).max(10000),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('image'),
                                                            url: z.string().pipe(z.url()),
                                                            alt: z.string().min(1).max(300),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('link'),
                                                            url: z.string().pipe(z.url()),
                                                            text: z.string().min(1).max(300),
                                                        }),
                                                    ])
                                                    .refine(
                                                        (value) =>
                                                            [
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ].filter((branch) => branch.safeParse(value).success)
                                                                .length === 1,
                                                    ),
                                            )
                                            .min(1)
                                            .max(30),
                                    }),
                                )
                                .min(1)
                                .max(10),
                            sources: z
                                .array(
                                    z.strictObject({
                                        claim: z.string().min(1).max(500),
                                        source: z.string().min(1).max(10000),
                                    }),
                                )
                                .max(30),
                            audience: z.strictObject({
                                plans: z
                                    .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                    .max(3),
                                genders: z
                                    .array(z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]))
                                    .max(3),
                                families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                registeredFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                registeredTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                            }),
                            channels: z
                                .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                .min(1)
                                .max(3),
                            category: z.union([z.literal('service'), z.literal('marketing')]),
                        }),
                        status: z.union([
                            z.literal('draft'),
                            z.literal('scheduled'),
                            z.literal('published'),
                            z.literal('cancelled'),
                        ]),
                        scheduledAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        history: z.array(
                            z.strictObject({
                                version: z.number().int().min(-9007199254740991).max(9007199254740991),
                                at: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                                content: z.strictObject({
                                    type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                                    title: z.string().min(1).max(200),
                                    pages: z
                                        .array(
                                            z.strictObject({
                                                blocks: z
                                                    .array(
                                                        z
                                                            .union([
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ])
                                                            .refine(
                                                                (value) =>
                                                                    [
                                                                        z.strictObject({
                                                                            kind: z.literal('text'),
                                                                            text: z.string().min(1).max(10000),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('image'),
                                                                            url: z.string().pipe(z.url()),
                                                                            alt: z.string().min(1).max(300),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('link'),
                                                                            url: z.string().pipe(z.url()),
                                                                            text: z.string().min(1).max(300),
                                                                        }),
                                                                    ].filter(
                                                                        (branch) => branch.safeParse(value).success,
                                                                    ).length === 1,
                                                            ),
                                                    )
                                                    .min(1)
                                                    .max(30),
                                            }),
                                        )
                                        .min(1)
                                        .max(10),
                                    sources: z
                                        .array(
                                            z.strictObject({
                                                claim: z.string().min(1).max(500),
                                                source: z.string().min(1).max(10000),
                                            }),
                                        )
                                        .max(30),
                                    audience: z.strictObject({
                                        plans: z
                                            .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                            .max(3),
                                        genders: z
                                            .array(
                                                z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]),
                                            )
                                            .max(3),
                                        families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                        registeredFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        registeredTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                    }),
                                    channels: z
                                        .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                        .min(1)
                                        .max(3),
                                    category: z.union([z.literal('service'), z.literal('marketing')]),
                                }),
                            }),
                        ),
                    }),
                ),
                preview: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().min(-9007199254740991).max(9007199254740991),
                        recipients: z.number().int().min(0).max(9007199254740991),
                        preliminary: z.literal(true),
                        mock: z.boolean(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/news-workspace/launch': {
        params: null,
        request: z.strictObject({
            action: z.literal('launch'),
            id: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            version: z.number().int().gt(0).max(9007199254740991),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            scheduledAt: z
                .string()
                .regex(
                    new RegExp(
                        '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                        'u',
                    ),
                )
                .pipe(z.iso.datetime())
                .nullable(),
        }),
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        content: z.strictObject({
                            type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                            title: z.string().min(1).max(200),
                            pages: z
                                .array(
                                    z.strictObject({
                                        blocks: z
                                            .array(
                                                z
                                                    .union([
                                                        z.strictObject({
                                                            kind: z.literal('text'),
                                                            text: z.string().min(1).max(10000),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('image'),
                                                            url: z.string().pipe(z.url()),
                                                            alt: z.string().min(1).max(300),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('link'),
                                                            url: z.string().pipe(z.url()),
                                                            text: z.string().min(1).max(300),
                                                        }),
                                                    ])
                                                    .refine(
                                                        (value) =>
                                                            [
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ].filter((branch) => branch.safeParse(value).success)
                                                                .length === 1,
                                                    ),
                                            )
                                            .min(1)
                                            .max(30),
                                    }),
                                )
                                .min(1)
                                .max(10),
                            sources: z
                                .array(
                                    z.strictObject({
                                        claim: z.string().min(1).max(500),
                                        source: z.string().min(1).max(10000),
                                    }),
                                )
                                .max(30),
                            audience: z.strictObject({
                                plans: z
                                    .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                    .max(3),
                                genders: z
                                    .array(z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]))
                                    .max(3),
                                families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                registeredFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                registeredTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                            }),
                            channels: z
                                .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                .min(1)
                                .max(3),
                            category: z.union([z.literal('service'), z.literal('marketing')]),
                        }),
                        status: z.union([
                            z.literal('draft'),
                            z.literal('scheduled'),
                            z.literal('published'),
                            z.literal('cancelled'),
                        ]),
                        scheduledAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        history: z.array(
                            z.strictObject({
                                version: z.number().int().min(-9007199254740991).max(9007199254740991),
                                at: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                                content: z.strictObject({
                                    type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                                    title: z.string().min(1).max(200),
                                    pages: z
                                        .array(
                                            z.strictObject({
                                                blocks: z
                                                    .array(
                                                        z
                                                            .union([
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ])
                                                            .refine(
                                                                (value) =>
                                                                    [
                                                                        z.strictObject({
                                                                            kind: z.literal('text'),
                                                                            text: z.string().min(1).max(10000),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('image'),
                                                                            url: z.string().pipe(z.url()),
                                                                            alt: z.string().min(1).max(300),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('link'),
                                                                            url: z.string().pipe(z.url()),
                                                                            text: z.string().min(1).max(300),
                                                                        }),
                                                                    ].filter(
                                                                        (branch) => branch.safeParse(value).success,
                                                                    ).length === 1,
                                                            ),
                                                    )
                                                    .min(1)
                                                    .max(30),
                                            }),
                                        )
                                        .min(1)
                                        .max(10),
                                    sources: z
                                        .array(
                                            z.strictObject({
                                                claim: z.string().min(1).max(500),
                                                source: z.string().min(1).max(10000),
                                            }),
                                        )
                                        .max(30),
                                    audience: z.strictObject({
                                        plans: z
                                            .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                            .max(3),
                                        genders: z
                                            .array(
                                                z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]),
                                            )
                                            .max(3),
                                        families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                        registeredFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        registeredTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                    }),
                                    channels: z
                                        .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                        .min(1)
                                        .max(3),
                                    category: z.union([z.literal('service'), z.literal('marketing')]),
                                }),
                            }),
                        ),
                    }),
                ),
                preview: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().min(-9007199254740991).max(9007199254740991),
                        recipients: z.number().int().min(0).max(9007199254740991),
                        preliminary: z.literal(true),
                        mock: z.boolean(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/news-workspace/cancel': {
        params: null,
        request: z.strictObject({
            action: z.literal('cancel'),
            id: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            version: z.number().int().gt(0).max(9007199254740991),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        content: z.strictObject({
                            type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                            title: z.string().min(1).max(200),
                            pages: z
                                .array(
                                    z.strictObject({
                                        blocks: z
                                            .array(
                                                z
                                                    .union([
                                                        z.strictObject({
                                                            kind: z.literal('text'),
                                                            text: z.string().min(1).max(10000),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('image'),
                                                            url: z.string().pipe(z.url()),
                                                            alt: z.string().min(1).max(300),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('link'),
                                                            url: z.string().pipe(z.url()),
                                                            text: z.string().min(1).max(300),
                                                        }),
                                                    ])
                                                    .refine(
                                                        (value) =>
                                                            [
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ].filter((branch) => branch.safeParse(value).success)
                                                                .length === 1,
                                                    ),
                                            )
                                            .min(1)
                                            .max(30),
                                    }),
                                )
                                .min(1)
                                .max(10),
                            sources: z
                                .array(
                                    z.strictObject({
                                        claim: z.string().min(1).max(500),
                                        source: z.string().min(1).max(10000),
                                    }),
                                )
                                .max(30),
                            audience: z.strictObject({
                                plans: z
                                    .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                    .max(3),
                                genders: z
                                    .array(z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]))
                                    .max(3),
                                families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                registeredFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                registeredTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                            }),
                            channels: z
                                .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                .min(1)
                                .max(3),
                            category: z.union([z.literal('service'), z.literal('marketing')]),
                        }),
                        status: z.union([
                            z.literal('draft'),
                            z.literal('scheduled'),
                            z.literal('published'),
                            z.literal('cancelled'),
                        ]),
                        scheduledAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        history: z.array(
                            z.strictObject({
                                version: z.number().int().min(-9007199254740991).max(9007199254740991),
                                at: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                                content: z.strictObject({
                                    type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                                    title: z.string().min(1).max(200),
                                    pages: z
                                        .array(
                                            z.strictObject({
                                                blocks: z
                                                    .array(
                                                        z
                                                            .union([
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ])
                                                            .refine(
                                                                (value) =>
                                                                    [
                                                                        z.strictObject({
                                                                            kind: z.literal('text'),
                                                                            text: z.string().min(1).max(10000),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('image'),
                                                                            url: z.string().pipe(z.url()),
                                                                            alt: z.string().min(1).max(300),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('link'),
                                                                            url: z.string().pipe(z.url()),
                                                                            text: z.string().min(1).max(300),
                                                                        }),
                                                                    ].filter(
                                                                        (branch) => branch.safeParse(value).success,
                                                                    ).length === 1,
                                                            ),
                                                    )
                                                    .min(1)
                                                    .max(30),
                                            }),
                                        )
                                        .min(1)
                                        .max(10),
                                    sources: z
                                        .array(
                                            z.strictObject({
                                                claim: z.string().min(1).max(500),
                                                source: z.string().min(1).max(10000),
                                            }),
                                        )
                                        .max(30),
                                    audience: z.strictObject({
                                        plans: z
                                            .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                            .max(3),
                                        genders: z
                                            .array(
                                                z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]),
                                            )
                                            .max(3),
                                        families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                        registeredFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        registeredTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                    }),
                                    channels: z
                                        .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                        .min(1)
                                        .max(3),
                                    category: z.union([z.literal('service'), z.literal('marketing')]),
                                }),
                            }),
                        ),
                    }),
                ),
                preview: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().min(-9007199254740991).max(9007199254740991),
                        recipients: z.number().int().min(0).max(9007199254740991),
                        preliminary: z.literal(true),
                        mock: z.boolean(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/news-workspace/test': {
        params: null,
        request: z.strictObject({
            action: z.literal('test'),
            id: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            version: z.number().int().gt(0).max(9007199254740991),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            recipients: z
                .array(z.union([z.literal('admin'), z.literal('moderator')]))
                .min(1)
                .max(2),
        }),
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        content: z.strictObject({
                            type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                            title: z.string().min(1).max(200),
                            pages: z
                                .array(
                                    z.strictObject({
                                        blocks: z
                                            .array(
                                                z
                                                    .union([
                                                        z.strictObject({
                                                            kind: z.literal('text'),
                                                            text: z.string().min(1).max(10000),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('image'),
                                                            url: z.string().pipe(z.url()),
                                                            alt: z.string().min(1).max(300),
                                                        }),
                                                        z.strictObject({
                                                            kind: z.literal('link'),
                                                            url: z.string().pipe(z.url()),
                                                            text: z.string().min(1).max(300),
                                                        }),
                                                    ])
                                                    .refine(
                                                        (value) =>
                                                            [
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ].filter((branch) => branch.safeParse(value).success)
                                                                .length === 1,
                                                    ),
                                            )
                                            .min(1)
                                            .max(30),
                                    }),
                                )
                                .min(1)
                                .max(10),
                            sources: z
                                .array(
                                    z.strictObject({
                                        claim: z.string().min(1).max(500),
                                        source: z.string().min(1).max(10000),
                                    }),
                                )
                                .max(30),
                            audience: z.strictObject({
                                plans: z
                                    .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                    .max(3),
                                genders: z
                                    .array(z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]))
                                    .max(3),
                                families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                registeredFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                registeredTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeFrom: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                                activeTo: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime())
                                    .nullable(),
                            }),
                            channels: z
                                .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                .min(1)
                                .max(3),
                            category: z.union([z.literal('service'), z.literal('marketing')]),
                        }),
                        status: z.union([
                            z.literal('draft'),
                            z.literal('scheduled'),
                            z.literal('published'),
                            z.literal('cancelled'),
                        ]),
                        scheduledAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        history: z.array(
                            z.strictObject({
                                version: z.number().int().min(-9007199254740991).max(9007199254740991),
                                at: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                                content: z.strictObject({
                                    type: z.union([z.literal('article'), z.literal('important')]).default('article'),
                                    title: z.string().min(1).max(200),
                                    pages: z
                                        .array(
                                            z.strictObject({
                                                blocks: z
                                                    .array(
                                                        z
                                                            .union([
                                                                z.strictObject({
                                                                    kind: z.literal('text'),
                                                                    text: z.string().min(1).max(10000),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('image'),
                                                                    url: z.string().pipe(z.url()),
                                                                    alt: z.string().min(1).max(300),
                                                                }),
                                                                z.strictObject({
                                                                    kind: z.literal('link'),
                                                                    url: z.string().pipe(z.url()),
                                                                    text: z.string().min(1).max(300),
                                                                }),
                                                            ])
                                                            .refine(
                                                                (value) =>
                                                                    [
                                                                        z.strictObject({
                                                                            kind: z.literal('text'),
                                                                            text: z.string().min(1).max(10000),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('image'),
                                                                            url: z.string().pipe(z.url()),
                                                                            alt: z.string().min(1).max(300),
                                                                        }),
                                                                        z.strictObject({
                                                                            kind: z.literal('link'),
                                                                            url: z.string().pipe(z.url()),
                                                                            text: z.string().min(1).max(300),
                                                                        }),
                                                                    ].filter(
                                                                        (branch) => branch.safeParse(value).success,
                                                                    ).length === 1,
                                                            ),
                                                    )
                                                    .min(1)
                                                    .max(30),
                                            }),
                                        )
                                        .min(1)
                                        .max(10),
                                    sources: z
                                        .array(
                                            z.strictObject({
                                                claim: z.string().min(1).max(500),
                                                source: z.string().min(1).max(10000),
                                            }),
                                        )
                                        .max(30),
                                    audience: z.strictObject({
                                        plans: z
                                            .array(z.union([z.literal('free'), z.literal('plus'), z.literal('pro')]))
                                            .max(3),
                                        genders: z
                                            .array(
                                                z.union([z.literal('female'), z.literal('male'), z.literal('unknown')]),
                                            )
                                            .max(3),
                                        families: z.array(z.union([z.literal('yes'), z.literal('no')])).max(2),
                                        registeredFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        registeredTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeFrom: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                        activeTo: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime())
                                            .nullable(),
                                    }),
                                    channels: z
                                        .array(z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]))
                                        .min(1)
                                        .max(3),
                                    category: z.union([z.literal('service'), z.literal('marketing')]),
                                }),
                            }),
                        ),
                    }),
                ),
                preview: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().min(-9007199254740991).max(9007199254740991),
                        recipients: z.number().int().min(0).max(9007199254740991),
                        preliminary: z.literal(true),
                        mock: z.boolean(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/account-deletions/{id}/review': {
        params: z.strictObject({ id: z.string() }),
        request: z.strictObject({
            decision: z.union([z.literal('approve'), z.literal('reject')]),
            expectedVersion: z.number().int().gt(0).max(9007199254740991),
            reason: z.string().min(10).max(1000),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                status: z.union([
                    z.literal('requested'),
                    z.literal('retention_wait'),
                    z.literal('ready'),
                    z.literal('cancelled'),
                    z.literal('rejected'),
                    z.literal('finalized'),
                    z.literal('blocked'),
                ]),
                requestedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                cancelUntil: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                finalizationNotBefore: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                cancelledAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                finalizedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                policyVersion: z.string().nullable(),
                blockers: z.array(
                    z.strictObject({
                        code: z.union([
                            z.literal('family_owner'),
                            z.literal('active_subscription'),
                            z.literal('payment_records'),
                            z.literal('support_history'),
                            z.literal('audit_history'),
                            z.literal('legal_hold'),
                            z.literal('retention_policy_unconfigured'),
                            z.literal('retention_policy_changed'),
                            z.literal('admin_approval_required'),
                            z.literal('retention_wait'),
                            z.literal('export_not_ready'),
                            z.literal('backup_exclusion'),
                        ]),
                        message: z.string().min(1).max(400),
                        blocksFinalization: z.boolean(),
                    }),
                ),
                version: z.number().int().gt(0).max(9007199254740991),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/content-releases': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        name: z.string(),
                        status: z.union([z.literal('draft'), z.literal('published')]),
                        version: z.number().int().gt(0).max(9007199254740991),
                        patchCount: z.number().int().min(0).max(9007199254740991),
                        createdAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        updatedAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        publishedAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        sourceReleaseId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid())
                            .nullable(),
                        rolledBackFromEventId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid())
                            .nullable(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/content-releases': {
        params: null,
        request: z.strictObject({
            name: z.string().min(1).max(160),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                name: z.string(),
                status: z.union([z.literal('draft'), z.literal('published')]),
                version: z.number().int().gt(0).max(9007199254740991),
                patchCount: z.number().int().min(0).max(9007199254740991),
                createdAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                updatedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                publishedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                sourceReleaseId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                rolledBackFromEventId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                patches: z.array(
                    z.union([
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                code: z.string().min(1).max(160),
                                title: z.string().min(1).max(160),
                                description: z.string().min(1).max(2000),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                category: z.union([
                                    z.literal('culinary'),
                                    z.literal('inventory'),
                                    z.literal('planning'),
                                    z.literal('author'),
                                    z.literal('community'),
                                    z.literal('catalog'),
                                    z.literal('collections'),
                                    z.literal('family'),
                                    z.literal('seasonal'),
                                    z.literal('secret'),
                                ]),
                                condition: z.record(
                                    z.string(),
                                    z.union([
                                        z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                        z
                                            .array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
                                            .max(100),
                                    ]),
                                ),
                                reputationDelta: z.number().int().min(0).max(10000),
                                secret: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                level: z.number().int().min(1).max(10),
                                threshold: z.number().int().min(0).max(1000000000),
                                title: z.string().min(1).max(160),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                kind: z.string().min(1).max(160),
                                content: z.string().min(1).max(200000),
                                effectiveAt: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                productId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                                description: z.string().min(1).max(2000),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z
                                .union([
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('help'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            slug: z.string().min(1).max(160),
                                            audience: z.union([
                                                z.literal('all'),
                                                z.literal('user'),
                                                z.literal('admin'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('pricing'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            plan: z.union([z.literal('free'), z.literal('plus')]),
                                            billingPeriod: z.union([
                                                z.literal('none'),
                                                z.literal('month'),
                                                z.literal('year'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('onboarding'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            flow: z.string().min(1).max(160),
                                            step: z.number().int().gt(0).max(9007199254740991),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('notification_template'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            channel: z.union([
                                                z.literal('in_app'),
                                                z.literal('email'),
                                                z.literal('push'),
                                            ]),
                                            templateKey: z.string().min(1).max(160),
                                            variables: z.array(z.string().min(1).max(160)).max(50),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('feature_copy'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            featureKey: z.string().min(1).max(160),
                                            placement: z.string().min(1).max(160),
                                        }),
                                    }),
                                ])
                                .refine(
                                    (value) =>
                                        [
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('help'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    slug: z.string().min(1).max(160),
                                                    audience: z.union([
                                                        z.literal('all'),
                                                        z.literal('user'),
                                                        z.literal('admin'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('pricing'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    plan: z.union([z.literal('free'), z.literal('plus')]),
                                                    billingPeriod: z.union([
                                                        z.literal('none'),
                                                        z.literal('month'),
                                                        z.literal('year'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('onboarding'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    flow: z.string().min(1).max(160),
                                                    step: z.number().int().gt(0).max(9007199254740991),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('notification_template'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    channel: z.union([
                                                        z.literal('in_app'),
                                                        z.literal('email'),
                                                        z.literal('push'),
                                                    ]),
                                                    templateKey: z.string().min(1).max(160),
                                                    variables: z.array(z.string().min(1).max(160)).max(50),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('feature_copy'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    featureKey: z.string().min(1).max(160),
                                                    placement: z.string().min(1).max(160),
                                                }),
                                            }),
                                        ].filter((branch) => branch.safeParse(value).success).length === 1,
                                ),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                schemaVersion: z.literal(1),
                                dictionary: z.union([z.literal('category'), z.literal('unit'), z.literal('allergen')]),
                                code: z.string().max(120).regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                                label: z.string().min(1).max(160),
                                description: z.string().max(2000).nullable(),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                sortOrder: z.number().int().min(0).max(1000000),
                                enabled: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                    ]),
                ),
                validation: z.strictObject({
                    valid: z.boolean(),
                    conflicts: z.array(z.string()),
                    errors: z.array(z.string()),
                }),
                ack: z
                    .strictObject({
                        clientRevision: z.number().int().gt(0).max(9007199254740991),
                        checksum: z.string().regex(new RegExp('^[a-f0-9]{64}$', 'u')),
                    })
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/content-releases/history': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        releaseId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        kind: z.union([z.literal('published'), z.literal('rolled_back')]),
                        createdAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        snapshot: z.array(
                            z.union([
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('achievement'),
                                    action: z.union([z.literal('create'), z.literal('update')]),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.strictObject({
                                        code: z.string().min(1).max(160),
                                        title: z.string().min(1).max(160),
                                        description: z.string().min(1).max(2000),
                                        icon: z.strictObject({
                                            assetId: z
                                                .string()
                                                .regex(
                                                    new RegExp(
                                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                        'u',
                                                    ),
                                                )
                                                .pipe(z.uuid())
                                                .nullable(),
                                            fallbackKey: z.string().min(1).max(80),
                                            alt: z.string().min(1).max(200),
                                        }),
                                        category: z.union([
                                            z.literal('culinary'),
                                            z.literal('inventory'),
                                            z.literal('planning'),
                                            z.literal('author'),
                                            z.literal('community'),
                                            z.literal('catalog'),
                                            z.literal('collections'),
                                            z.literal('family'),
                                            z.literal('seasonal'),
                                            z.literal('secret'),
                                        ]),
                                        condition: z.record(
                                            z.string(),
                                            z.union([
                                                z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                                z
                                                    .array(
                                                        z.union([
                                                            z.string().max(500),
                                                            z.number(),
                                                            z.boolean(),
                                                            z.null(),
                                                        ]),
                                                    )
                                                    .max(100),
                                            ]),
                                        ),
                                        reputationDelta: z.number().int().min(0).max(10000),
                                        secret: z.boolean(),
                                    }),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('achievement'),
                                    action: z.literal('retire'),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.null(),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('reputation_title'),
                                    action: z.union([z.literal('create'), z.literal('update')]),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.strictObject({
                                        level: z.number().int().min(1).max(10),
                                        threshold: z.number().int().min(0).max(1000000000),
                                        title: z.string().min(1).max(160),
                                    }),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('reputation_title'),
                                    action: z.literal('retire'),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.null(),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('legal_text'),
                                    action: z.union([z.literal('create'), z.literal('update')]),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.strictObject({
                                        kind: z.string().min(1).max(160),
                                        content: z.string().min(1).max(200000),
                                        effectiveAt: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.iso.datetime()),
                                    }),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('legal_text'),
                                    action: z.literal('retire'),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.null(),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('product_description'),
                                    action: z.union([z.literal('create'), z.literal('update')]),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.strictObject({
                                        productId: z
                                            .string()
                                            .regex(
                                                new RegExp(
                                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                    'u',
                                                ),
                                            )
                                            .pipe(z.uuid()),
                                        description: z.string().min(1).max(2000),
                                    }),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('product_description'),
                                    action: z.literal('retire'),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.null(),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('content_document'),
                                    action: z.union([z.literal('create'), z.literal('update')]),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z
                                        .union([
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('help'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    slug: z.string().min(1).max(160),
                                                    audience: z.union([
                                                        z.literal('all'),
                                                        z.literal('user'),
                                                        z.literal('admin'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('pricing'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    plan: z.union([z.literal('free'), z.literal('plus')]),
                                                    billingPeriod: z.union([
                                                        z.literal('none'),
                                                        z.literal('month'),
                                                        z.literal('year'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('onboarding'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    flow: z.string().min(1).max(160),
                                                    step: z.number().int().gt(0).max(9007199254740991),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('notification_template'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    channel: z.union([
                                                        z.literal('in_app'),
                                                        z.literal('email'),
                                                        z.literal('push'),
                                                    ]),
                                                    templateKey: z.string().min(1).max(160),
                                                    variables: z.array(z.string().min(1).max(160)).max(50),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('feature_copy'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    featureKey: z.string().min(1).max(160),
                                                    placement: z.string().min(1).max(160),
                                                }),
                                            }),
                                        ])
                                        .refine(
                                            (value) =>
                                                [
                                                    z.strictObject({
                                                        locale: z
                                                            .string()
                                                            .regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                        title: z.string().min(1).max(160),
                                                        body: z.string().min(1).max(200000),
                                                        namespace: z.literal('help'),
                                                        metadata: z.strictObject({
                                                            schemaVersion: z.literal(1),
                                                            slug: z.string().min(1).max(160),
                                                            audience: z.union([
                                                                z.literal('all'),
                                                                z.literal('user'),
                                                                z.literal('admin'),
                                                            ]),
                                                        }),
                                                    }),
                                                    z.strictObject({
                                                        locale: z
                                                            .string()
                                                            .regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                        title: z.string().min(1).max(160),
                                                        body: z.string().min(1).max(200000),
                                                        namespace: z.literal('pricing'),
                                                        metadata: z.strictObject({
                                                            schemaVersion: z.literal(1),
                                                            plan: z.union([z.literal('free'), z.literal('plus')]),
                                                            billingPeriod: z.union([
                                                                z.literal('none'),
                                                                z.literal('month'),
                                                                z.literal('year'),
                                                            ]),
                                                        }),
                                                    }),
                                                    z.strictObject({
                                                        locale: z
                                                            .string()
                                                            .regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                        title: z.string().min(1).max(160),
                                                        body: z.string().min(1).max(200000),
                                                        namespace: z.literal('onboarding'),
                                                        metadata: z.strictObject({
                                                            schemaVersion: z.literal(1),
                                                            flow: z.string().min(1).max(160),
                                                            step: z.number().int().gt(0).max(9007199254740991),
                                                        }),
                                                    }),
                                                    z.strictObject({
                                                        locale: z
                                                            .string()
                                                            .regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                        title: z.string().min(1).max(160),
                                                        body: z.string().min(1).max(200000),
                                                        namespace: z.literal('notification_template'),
                                                        metadata: z.strictObject({
                                                            schemaVersion: z.literal(1),
                                                            channel: z.union([
                                                                z.literal('in_app'),
                                                                z.literal('email'),
                                                                z.literal('push'),
                                                            ]),
                                                            templateKey: z.string().min(1).max(160),
                                                            variables: z.array(z.string().min(1).max(160)).max(50),
                                                        }),
                                                    }),
                                                    z.strictObject({
                                                        locale: z
                                                            .string()
                                                            .regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                        title: z.string().min(1).max(160),
                                                        body: z.string().min(1).max(200000),
                                                        namespace: z.literal('feature_copy'),
                                                        metadata: z.strictObject({
                                                            schemaVersion: z.literal(1),
                                                            featureKey: z.string().min(1).max(160),
                                                            placement: z.string().min(1).max(160),
                                                        }),
                                                    }),
                                                ].filter((branch) => branch.safeParse(value).success).length === 1,
                                        ),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('content_document'),
                                    action: z.literal('retire'),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.null(),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('dictionary_entry'),
                                    action: z.union([z.literal('create'), z.literal('update')]),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.strictObject({
                                        schemaVersion: z.literal(1),
                                        dictionary: z.union([
                                            z.literal('category'),
                                            z.literal('unit'),
                                            z.literal('allergen'),
                                        ]),
                                        code: z
                                            .string()
                                            .max(120)
                                            .regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                                        label: z.string().min(1).max(160),
                                        description: z.string().max(2000).nullable(),
                                        icon: z.strictObject({
                                            assetId: z
                                                .string()
                                                .regex(
                                                    new RegExp(
                                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                        'u',
                                                    ),
                                                )
                                                .pipe(z.uuid())
                                                .nullable(),
                                            fallbackKey: z.string().min(1).max(80),
                                            alt: z.string().min(1).max(200),
                                        }),
                                        sortOrder: z.number().int().min(0).max(1000000),
                                        enabled: z.boolean(),
                                    }),
                                }),
                                z.strictObject({
                                    patchId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid()),
                                    expectedVersion: z.number().int().min(0).max(9007199254740991),
                                    resourceType: z.literal('dictionary_entry'),
                                    action: z.literal('retire'),
                                    resourceKey: z.string().min(1).max(160),
                                    payload: z.null(),
                                }),
                            ]),
                        ),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/content-releases/sources': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                achievements: z.array(
                    z.strictObject({
                        key: z.string().min(1).max(160),
                        version: z.number().int().gt(0).max(9007199254740991),
                        retired: z.boolean(),
                        value: z.strictObject({
                            code: z.string().min(1).max(160),
                            title: z.string().min(1).max(160),
                            description: z.string().min(1).max(2000),
                            icon: z.strictObject({
                                assetId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid())
                                    .nullable(),
                                fallbackKey: z.string().min(1).max(80),
                                alt: z.string().min(1).max(200),
                            }),
                            category: z.union([
                                z.literal('culinary'),
                                z.literal('inventory'),
                                z.literal('planning'),
                                z.literal('author'),
                                z.literal('community'),
                                z.literal('catalog'),
                                z.literal('collections'),
                                z.literal('family'),
                                z.literal('seasonal'),
                                z.literal('secret'),
                            ]),
                            condition: z.record(
                                z.string(),
                                z.union([
                                    z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                    z.array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).max(100),
                                ]),
                            ),
                            reputationDelta: z.number().int().min(0).max(10000),
                            secret: z.boolean(),
                        }),
                    }),
                ),
                reputationTitles: z.array(
                    z.strictObject({
                        key: z.string().min(1).max(160),
                        version: z.number().int().gt(0).max(9007199254740991),
                        retired: z.boolean(),
                        value: z.strictObject({
                            level: z.number().int().min(1).max(10),
                            threshold: z.number().int().min(0).max(1000000000),
                            title: z.string().min(1).max(160),
                        }),
                    }),
                ),
                legalTexts: z.array(
                    z.strictObject({
                        key: z.string().min(1).max(160),
                        version: z.number().int().gt(0).max(9007199254740991),
                        retired: z.boolean(),
                        value: z.strictObject({
                            kind: z.string().min(1).max(160),
                            content: z.string().min(1).max(200000),
                            effectiveAt: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                        'u',
                                    ),
                                )
                                .pipe(z.iso.datetime()),
                        }),
                    }),
                ),
                products: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        name: z.string(),
                        version: z.number().int().min(0).max(9007199254740991),
                        description: z.string().nullable(),
                    }),
                ),
                contentDocuments: z.array(
                    z.strictObject({
                        key: z.string().min(1).max(160),
                        version: z.number().int().gt(0).max(9007199254740991),
                        retired: z.boolean(),
                        value: z
                            .union([
                                z.strictObject({
                                    locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                    title: z.string().min(1).max(160),
                                    body: z.string().min(1).max(200000),
                                    namespace: z.literal('help'),
                                    metadata: z.strictObject({
                                        schemaVersion: z.literal(1),
                                        slug: z.string().min(1).max(160),
                                        audience: z.union([z.literal('all'), z.literal('user'), z.literal('admin')]),
                                    }),
                                }),
                                z.strictObject({
                                    locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                    title: z.string().min(1).max(160),
                                    body: z.string().min(1).max(200000),
                                    namespace: z.literal('pricing'),
                                    metadata: z.strictObject({
                                        schemaVersion: z.literal(1),
                                        plan: z.union([z.literal('free'), z.literal('plus')]),
                                        billingPeriod: z.union([
                                            z.literal('none'),
                                            z.literal('month'),
                                            z.literal('year'),
                                        ]),
                                    }),
                                }),
                                z.strictObject({
                                    locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                    title: z.string().min(1).max(160),
                                    body: z.string().min(1).max(200000),
                                    namespace: z.literal('onboarding'),
                                    metadata: z.strictObject({
                                        schemaVersion: z.literal(1),
                                        flow: z.string().min(1).max(160),
                                        step: z.number().int().gt(0).max(9007199254740991),
                                    }),
                                }),
                                z.strictObject({
                                    locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                    title: z.string().min(1).max(160),
                                    body: z.string().min(1).max(200000),
                                    namespace: z.literal('notification_template'),
                                    metadata: z.strictObject({
                                        schemaVersion: z.literal(1),
                                        channel: z.union([z.literal('in_app'), z.literal('email'), z.literal('push')]),
                                        templateKey: z.string().min(1).max(160),
                                        variables: z.array(z.string().min(1).max(160)).max(50),
                                    }),
                                }),
                                z.strictObject({
                                    locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                    title: z.string().min(1).max(160),
                                    body: z.string().min(1).max(200000),
                                    namespace: z.literal('feature_copy'),
                                    metadata: z.strictObject({
                                        schemaVersion: z.literal(1),
                                        featureKey: z.string().min(1).max(160),
                                        placement: z.string().min(1).max(160),
                                    }),
                                }),
                            ])
                            .refine(
                                (value) =>
                                    [
                                        z.strictObject({
                                            locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                            title: z.string().min(1).max(160),
                                            body: z.string().min(1).max(200000),
                                            namespace: z.literal('help'),
                                            metadata: z.strictObject({
                                                schemaVersion: z.literal(1),
                                                slug: z.string().min(1).max(160),
                                                audience: z.union([
                                                    z.literal('all'),
                                                    z.literal('user'),
                                                    z.literal('admin'),
                                                ]),
                                            }),
                                        }),
                                        z.strictObject({
                                            locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                            title: z.string().min(1).max(160),
                                            body: z.string().min(1).max(200000),
                                            namespace: z.literal('pricing'),
                                            metadata: z.strictObject({
                                                schemaVersion: z.literal(1),
                                                plan: z.union([z.literal('free'), z.literal('plus')]),
                                                billingPeriod: z.union([
                                                    z.literal('none'),
                                                    z.literal('month'),
                                                    z.literal('year'),
                                                ]),
                                            }),
                                        }),
                                        z.strictObject({
                                            locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                            title: z.string().min(1).max(160),
                                            body: z.string().min(1).max(200000),
                                            namespace: z.literal('onboarding'),
                                            metadata: z.strictObject({
                                                schemaVersion: z.literal(1),
                                                flow: z.string().min(1).max(160),
                                                step: z.number().int().gt(0).max(9007199254740991),
                                            }),
                                        }),
                                        z.strictObject({
                                            locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                            title: z.string().min(1).max(160),
                                            body: z.string().min(1).max(200000),
                                            namespace: z.literal('notification_template'),
                                            metadata: z.strictObject({
                                                schemaVersion: z.literal(1),
                                                channel: z.union([
                                                    z.literal('in_app'),
                                                    z.literal('email'),
                                                    z.literal('push'),
                                                ]),
                                                templateKey: z.string().min(1).max(160),
                                                variables: z.array(z.string().min(1).max(160)).max(50),
                                            }),
                                        }),
                                        z.strictObject({
                                            locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                            title: z.string().min(1).max(160),
                                            body: z.string().min(1).max(200000),
                                            namespace: z.literal('feature_copy'),
                                            metadata: z.strictObject({
                                                schemaVersion: z.literal(1),
                                                featureKey: z.string().min(1).max(160),
                                                placement: z.string().min(1).max(160),
                                            }),
                                        }),
                                    ].filter((branch) => branch.safeParse(value).success).length === 1,
                            ),
                    }),
                ),
                dictionaryEntries: z.array(
                    z.strictObject({
                        key: z.string().min(1).max(160),
                        version: z.number().int().gt(0).max(9007199254740991),
                        retired: z.boolean(),
                        value: z.strictObject({
                            schemaVersion: z.literal(1),
                            dictionary: z.union([z.literal('category'), z.literal('unit'), z.literal('allergen')]),
                            code: z.string().max(120).regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                            label: z.string().min(1).max(160),
                            description: z.string().max(2000).nullable(),
                            icon: z.strictObject({
                                assetId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid())
                                    .nullable(),
                                fallbackKey: z.string().min(1).max(80),
                                alt: z.string().min(1).max(200),
                            }),
                            sortOrder: z.number().int().min(0).max(1000000),
                            enabled: z.boolean(),
                        }),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/content-releases/{id}': {
        params: z.strictObject({ id: z.string().pipe(z.uuid()) }),
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                name: z.string(),
                status: z.union([z.literal('draft'), z.literal('published')]),
                version: z.number().int().gt(0).max(9007199254740991),
                patchCount: z.number().int().min(0).max(9007199254740991),
                createdAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                updatedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                publishedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                sourceReleaseId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                rolledBackFromEventId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                patches: z.array(
                    z.union([
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                code: z.string().min(1).max(160),
                                title: z.string().min(1).max(160),
                                description: z.string().min(1).max(2000),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                category: z.union([
                                    z.literal('culinary'),
                                    z.literal('inventory'),
                                    z.literal('planning'),
                                    z.literal('author'),
                                    z.literal('community'),
                                    z.literal('catalog'),
                                    z.literal('collections'),
                                    z.literal('family'),
                                    z.literal('seasonal'),
                                    z.literal('secret'),
                                ]),
                                condition: z.record(
                                    z.string(),
                                    z.union([
                                        z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                        z
                                            .array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
                                            .max(100),
                                    ]),
                                ),
                                reputationDelta: z.number().int().min(0).max(10000),
                                secret: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                level: z.number().int().min(1).max(10),
                                threshold: z.number().int().min(0).max(1000000000),
                                title: z.string().min(1).max(160),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                kind: z.string().min(1).max(160),
                                content: z.string().min(1).max(200000),
                                effectiveAt: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                productId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                                description: z.string().min(1).max(2000),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z
                                .union([
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('help'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            slug: z.string().min(1).max(160),
                                            audience: z.union([
                                                z.literal('all'),
                                                z.literal('user'),
                                                z.literal('admin'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('pricing'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            plan: z.union([z.literal('free'), z.literal('plus')]),
                                            billingPeriod: z.union([
                                                z.literal('none'),
                                                z.literal('month'),
                                                z.literal('year'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('onboarding'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            flow: z.string().min(1).max(160),
                                            step: z.number().int().gt(0).max(9007199254740991),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('notification_template'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            channel: z.union([
                                                z.literal('in_app'),
                                                z.literal('email'),
                                                z.literal('push'),
                                            ]),
                                            templateKey: z.string().min(1).max(160),
                                            variables: z.array(z.string().min(1).max(160)).max(50),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('feature_copy'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            featureKey: z.string().min(1).max(160),
                                            placement: z.string().min(1).max(160),
                                        }),
                                    }),
                                ])
                                .refine(
                                    (value) =>
                                        [
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('help'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    slug: z.string().min(1).max(160),
                                                    audience: z.union([
                                                        z.literal('all'),
                                                        z.literal('user'),
                                                        z.literal('admin'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('pricing'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    plan: z.union([z.literal('free'), z.literal('plus')]),
                                                    billingPeriod: z.union([
                                                        z.literal('none'),
                                                        z.literal('month'),
                                                        z.literal('year'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('onboarding'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    flow: z.string().min(1).max(160),
                                                    step: z.number().int().gt(0).max(9007199254740991),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('notification_template'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    channel: z.union([
                                                        z.literal('in_app'),
                                                        z.literal('email'),
                                                        z.literal('push'),
                                                    ]),
                                                    templateKey: z.string().min(1).max(160),
                                                    variables: z.array(z.string().min(1).max(160)).max(50),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('feature_copy'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    featureKey: z.string().min(1).max(160),
                                                    placement: z.string().min(1).max(160),
                                                }),
                                            }),
                                        ].filter((branch) => branch.safeParse(value).success).length === 1,
                                ),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                schemaVersion: z.literal(1),
                                dictionary: z.union([z.literal('category'), z.literal('unit'), z.literal('allergen')]),
                                code: z.string().max(120).regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                                label: z.string().min(1).max(160),
                                description: z.string().max(2000).nullable(),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                sortOrder: z.number().int().min(0).max(1000000),
                                enabled: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                    ]),
                ),
                validation: z.strictObject({
                    valid: z.boolean(),
                    conflicts: z.array(z.string()),
                    errors: z.array(z.string()),
                }),
                ack: z
                    .strictObject({
                        clientRevision: z.number().int().gt(0).max(9007199254740991),
                        checksum: z.string().regex(new RegExp('^[a-f0-9]{64}$', 'u')),
                    })
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'PUT /api/v1/admin/content-releases/{id}': {
        params: z.strictObject({ id: z.string() }),
        request: z.strictObject({
            name: z.string().min(1).max(160),
            expectedVersion: z.number().int().gt(0).max(9007199254740991),
            patches: z
                .array(
                    z.union([
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                code: z.string().min(1).max(160),
                                title: z.string().min(1).max(160),
                                description: z.string().min(1).max(2000),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                category: z.union([
                                    z.literal('culinary'),
                                    z.literal('inventory'),
                                    z.literal('planning'),
                                    z.literal('author'),
                                    z.literal('community'),
                                    z.literal('catalog'),
                                    z.literal('collections'),
                                    z.literal('family'),
                                    z.literal('seasonal'),
                                    z.literal('secret'),
                                ]),
                                condition: z.record(
                                    z.string(),
                                    z.union([
                                        z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                        z
                                            .array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
                                            .max(100),
                                    ]),
                                ),
                                reputationDelta: z.number().int().min(0).max(10000),
                                secret: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                level: z.number().int().min(1).max(10),
                                threshold: z.number().int().min(0).max(1000000000),
                                title: z.string().min(1).max(160),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                kind: z.string().min(1).max(160),
                                content: z.string().min(1).max(200000),
                                effectiveAt: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                productId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                                description: z.string().min(1).max(2000),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z
                                .union([
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('help'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            slug: z.string().min(1).max(160),
                                            audience: z.union([
                                                z.literal('all'),
                                                z.literal('user'),
                                                z.literal('admin'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('pricing'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            plan: z.union([z.literal('free'), z.literal('plus')]),
                                            billingPeriod: z.union([
                                                z.literal('none'),
                                                z.literal('month'),
                                                z.literal('year'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('onboarding'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            flow: z.string().min(1).max(160),
                                            step: z.number().int().gt(0).max(9007199254740991),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('notification_template'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            channel: z.union([
                                                z.literal('in_app'),
                                                z.literal('email'),
                                                z.literal('push'),
                                            ]),
                                            templateKey: z.string().min(1).max(160),
                                            variables: z.array(z.string().min(1).max(160)).max(50),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('feature_copy'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            featureKey: z.string().min(1).max(160),
                                            placement: z.string().min(1).max(160),
                                        }),
                                    }),
                                ])
                                .refine(
                                    (value) =>
                                        [
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('help'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    slug: z.string().min(1).max(160),
                                                    audience: z.union([
                                                        z.literal('all'),
                                                        z.literal('user'),
                                                        z.literal('admin'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('pricing'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    plan: z.union([z.literal('free'), z.literal('plus')]),
                                                    billingPeriod: z.union([
                                                        z.literal('none'),
                                                        z.literal('month'),
                                                        z.literal('year'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('onboarding'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    flow: z.string().min(1).max(160),
                                                    step: z.number().int().gt(0).max(9007199254740991),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('notification_template'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    channel: z.union([
                                                        z.literal('in_app'),
                                                        z.literal('email'),
                                                        z.literal('push'),
                                                    ]),
                                                    templateKey: z.string().min(1).max(160),
                                                    variables: z.array(z.string().min(1).max(160)).max(50),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('feature_copy'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    featureKey: z.string().min(1).max(160),
                                                    placement: z.string().min(1).max(160),
                                                }),
                                            }),
                                        ].filter((branch) => branch.safeParse(value).success).length === 1,
                                ),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                schemaVersion: z.literal(1),
                                dictionary: z.union([z.literal('category'), z.literal('unit'), z.literal('allergen')]),
                                code: z.string().max(120).regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                                label: z.string().min(1).max(160),
                                description: z.string().max(2000).nullable(),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                sortOrder: z.number().int().min(0).max(1000000),
                                enabled: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                    ]),
                )
                .max(500),
            clientRevision: z.number().int().gt(0).max(9007199254740991),
            checksum: z.string().regex(new RegExp('^[a-f0-9]{64}$', 'u')),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                name: z.string(),
                status: z.union([z.literal('draft'), z.literal('published')]),
                version: z.number().int().gt(0).max(9007199254740991),
                patchCount: z.number().int().min(0).max(9007199254740991),
                createdAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                updatedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                publishedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                sourceReleaseId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                rolledBackFromEventId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                patches: z.array(
                    z.union([
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                code: z.string().min(1).max(160),
                                title: z.string().min(1).max(160),
                                description: z.string().min(1).max(2000),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                category: z.union([
                                    z.literal('culinary'),
                                    z.literal('inventory'),
                                    z.literal('planning'),
                                    z.literal('author'),
                                    z.literal('community'),
                                    z.literal('catalog'),
                                    z.literal('collections'),
                                    z.literal('family'),
                                    z.literal('seasonal'),
                                    z.literal('secret'),
                                ]),
                                condition: z.record(
                                    z.string(),
                                    z.union([
                                        z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                        z
                                            .array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
                                            .max(100),
                                    ]),
                                ),
                                reputationDelta: z.number().int().min(0).max(10000),
                                secret: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                level: z.number().int().min(1).max(10),
                                threshold: z.number().int().min(0).max(1000000000),
                                title: z.string().min(1).max(160),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                kind: z.string().min(1).max(160),
                                content: z.string().min(1).max(200000),
                                effectiveAt: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                productId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                                description: z.string().min(1).max(2000),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z
                                .union([
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('help'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            slug: z.string().min(1).max(160),
                                            audience: z.union([
                                                z.literal('all'),
                                                z.literal('user'),
                                                z.literal('admin'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('pricing'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            plan: z.union([z.literal('free'), z.literal('plus')]),
                                            billingPeriod: z.union([
                                                z.literal('none'),
                                                z.literal('month'),
                                                z.literal('year'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('onboarding'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            flow: z.string().min(1).max(160),
                                            step: z.number().int().gt(0).max(9007199254740991),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('notification_template'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            channel: z.union([
                                                z.literal('in_app'),
                                                z.literal('email'),
                                                z.literal('push'),
                                            ]),
                                            templateKey: z.string().min(1).max(160),
                                            variables: z.array(z.string().min(1).max(160)).max(50),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('feature_copy'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            featureKey: z.string().min(1).max(160),
                                            placement: z.string().min(1).max(160),
                                        }),
                                    }),
                                ])
                                .refine(
                                    (value) =>
                                        [
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('help'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    slug: z.string().min(1).max(160),
                                                    audience: z.union([
                                                        z.literal('all'),
                                                        z.literal('user'),
                                                        z.literal('admin'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('pricing'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    plan: z.union([z.literal('free'), z.literal('plus')]),
                                                    billingPeriod: z.union([
                                                        z.literal('none'),
                                                        z.literal('month'),
                                                        z.literal('year'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('onboarding'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    flow: z.string().min(1).max(160),
                                                    step: z.number().int().gt(0).max(9007199254740991),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('notification_template'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    channel: z.union([
                                                        z.literal('in_app'),
                                                        z.literal('email'),
                                                        z.literal('push'),
                                                    ]),
                                                    templateKey: z.string().min(1).max(160),
                                                    variables: z.array(z.string().min(1).max(160)).max(50),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('feature_copy'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    featureKey: z.string().min(1).max(160),
                                                    placement: z.string().min(1).max(160),
                                                }),
                                            }),
                                        ].filter((branch) => branch.safeParse(value).success).length === 1,
                                ),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                schemaVersion: z.literal(1),
                                dictionary: z.union([z.literal('category'), z.literal('unit'), z.literal('allergen')]),
                                code: z.string().max(120).regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                                label: z.string().min(1).max(160),
                                description: z.string().max(2000).nullable(),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                sortOrder: z.number().int().min(0).max(1000000),
                                enabled: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                    ]),
                ),
                validation: z.strictObject({
                    valid: z.boolean(),
                    conflicts: z.array(z.string()),
                    errors: z.array(z.string()),
                }),
                ack: z
                    .strictObject({
                        clientRevision: z.number().int().gt(0).max(9007199254740991),
                        checksum: z.string().regex(new RegExp('^[a-f0-9]{64}$', 'u')),
                    })
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/content-releases/{id}/validate': {
        params: z.strictObject({ id: z.string() }),
        request: z.strictObject({ expectedVersion: z.number().int().gt(0).max(9007199254740991) }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                name: z.string(),
                status: z.union([z.literal('draft'), z.literal('published')]),
                version: z.number().int().gt(0).max(9007199254740991),
                patchCount: z.number().int().min(0).max(9007199254740991),
                createdAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                updatedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                publishedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                sourceReleaseId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                rolledBackFromEventId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                patches: z.array(
                    z.union([
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                code: z.string().min(1).max(160),
                                title: z.string().min(1).max(160),
                                description: z.string().min(1).max(2000),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                category: z.union([
                                    z.literal('culinary'),
                                    z.literal('inventory'),
                                    z.literal('planning'),
                                    z.literal('author'),
                                    z.literal('community'),
                                    z.literal('catalog'),
                                    z.literal('collections'),
                                    z.literal('family'),
                                    z.literal('seasonal'),
                                    z.literal('secret'),
                                ]),
                                condition: z.record(
                                    z.string(),
                                    z.union([
                                        z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                        z
                                            .array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
                                            .max(100),
                                    ]),
                                ),
                                reputationDelta: z.number().int().min(0).max(10000),
                                secret: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                level: z.number().int().min(1).max(10),
                                threshold: z.number().int().min(0).max(1000000000),
                                title: z.string().min(1).max(160),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                kind: z.string().min(1).max(160),
                                content: z.string().min(1).max(200000),
                                effectiveAt: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                productId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                                description: z.string().min(1).max(2000),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z
                                .union([
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('help'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            slug: z.string().min(1).max(160),
                                            audience: z.union([
                                                z.literal('all'),
                                                z.literal('user'),
                                                z.literal('admin'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('pricing'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            plan: z.union([z.literal('free'), z.literal('plus')]),
                                            billingPeriod: z.union([
                                                z.literal('none'),
                                                z.literal('month'),
                                                z.literal('year'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('onboarding'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            flow: z.string().min(1).max(160),
                                            step: z.number().int().gt(0).max(9007199254740991),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('notification_template'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            channel: z.union([
                                                z.literal('in_app'),
                                                z.literal('email'),
                                                z.literal('push'),
                                            ]),
                                            templateKey: z.string().min(1).max(160),
                                            variables: z.array(z.string().min(1).max(160)).max(50),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('feature_copy'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            featureKey: z.string().min(1).max(160),
                                            placement: z.string().min(1).max(160),
                                        }),
                                    }),
                                ])
                                .refine(
                                    (value) =>
                                        [
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('help'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    slug: z.string().min(1).max(160),
                                                    audience: z.union([
                                                        z.literal('all'),
                                                        z.literal('user'),
                                                        z.literal('admin'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('pricing'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    plan: z.union([z.literal('free'), z.literal('plus')]),
                                                    billingPeriod: z.union([
                                                        z.literal('none'),
                                                        z.literal('month'),
                                                        z.literal('year'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('onboarding'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    flow: z.string().min(1).max(160),
                                                    step: z.number().int().gt(0).max(9007199254740991),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('notification_template'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    channel: z.union([
                                                        z.literal('in_app'),
                                                        z.literal('email'),
                                                        z.literal('push'),
                                                    ]),
                                                    templateKey: z.string().min(1).max(160),
                                                    variables: z.array(z.string().min(1).max(160)).max(50),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('feature_copy'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    featureKey: z.string().min(1).max(160),
                                                    placement: z.string().min(1).max(160),
                                                }),
                                            }),
                                        ].filter((branch) => branch.safeParse(value).success).length === 1,
                                ),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                schemaVersion: z.literal(1),
                                dictionary: z.union([z.literal('category'), z.literal('unit'), z.literal('allergen')]),
                                code: z.string().max(120).regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                                label: z.string().min(1).max(160),
                                description: z.string().max(2000).nullable(),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                sortOrder: z.number().int().min(0).max(1000000),
                                enabled: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                    ]),
                ),
                validation: z.strictObject({
                    valid: z.boolean(),
                    conflicts: z.array(z.string()),
                    errors: z.array(z.string()),
                }),
                ack: z
                    .strictObject({
                        clientRevision: z.number().int().gt(0).max(9007199254740991),
                        checksum: z.string().regex(new RegExp('^[a-f0-9]{64}$', 'u')),
                    })
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/content-releases/{id}/publish': {
        params: z.strictObject({ id: z.string() }),
        request: z.strictObject({
            expectedVersion: z.number().int().gt(0).max(9007199254740991),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                name: z.string(),
                status: z.union([z.literal('draft'), z.literal('published')]),
                version: z.number().int().gt(0).max(9007199254740991),
                patchCount: z.number().int().min(0).max(9007199254740991),
                createdAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                updatedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                publishedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                sourceReleaseId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                rolledBackFromEventId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                patches: z.array(
                    z.union([
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                code: z.string().min(1).max(160),
                                title: z.string().min(1).max(160),
                                description: z.string().min(1).max(2000),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                category: z.union([
                                    z.literal('culinary'),
                                    z.literal('inventory'),
                                    z.literal('planning'),
                                    z.literal('author'),
                                    z.literal('community'),
                                    z.literal('catalog'),
                                    z.literal('collections'),
                                    z.literal('family'),
                                    z.literal('seasonal'),
                                    z.literal('secret'),
                                ]),
                                condition: z.record(
                                    z.string(),
                                    z.union([
                                        z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                        z
                                            .array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
                                            .max(100),
                                    ]),
                                ),
                                reputationDelta: z.number().int().min(0).max(10000),
                                secret: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                level: z.number().int().min(1).max(10),
                                threshold: z.number().int().min(0).max(1000000000),
                                title: z.string().min(1).max(160),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                kind: z.string().min(1).max(160),
                                content: z.string().min(1).max(200000),
                                effectiveAt: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                productId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                                description: z.string().min(1).max(2000),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z
                                .union([
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('help'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            slug: z.string().min(1).max(160),
                                            audience: z.union([
                                                z.literal('all'),
                                                z.literal('user'),
                                                z.literal('admin'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('pricing'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            plan: z.union([z.literal('free'), z.literal('plus')]),
                                            billingPeriod: z.union([
                                                z.literal('none'),
                                                z.literal('month'),
                                                z.literal('year'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('onboarding'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            flow: z.string().min(1).max(160),
                                            step: z.number().int().gt(0).max(9007199254740991),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('notification_template'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            channel: z.union([
                                                z.literal('in_app'),
                                                z.literal('email'),
                                                z.literal('push'),
                                            ]),
                                            templateKey: z.string().min(1).max(160),
                                            variables: z.array(z.string().min(1).max(160)).max(50),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('feature_copy'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            featureKey: z.string().min(1).max(160),
                                            placement: z.string().min(1).max(160),
                                        }),
                                    }),
                                ])
                                .refine(
                                    (value) =>
                                        [
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('help'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    slug: z.string().min(1).max(160),
                                                    audience: z.union([
                                                        z.literal('all'),
                                                        z.literal('user'),
                                                        z.literal('admin'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('pricing'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    plan: z.union([z.literal('free'), z.literal('plus')]),
                                                    billingPeriod: z.union([
                                                        z.literal('none'),
                                                        z.literal('month'),
                                                        z.literal('year'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('onboarding'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    flow: z.string().min(1).max(160),
                                                    step: z.number().int().gt(0).max(9007199254740991),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('notification_template'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    channel: z.union([
                                                        z.literal('in_app'),
                                                        z.literal('email'),
                                                        z.literal('push'),
                                                    ]),
                                                    templateKey: z.string().min(1).max(160),
                                                    variables: z.array(z.string().min(1).max(160)).max(50),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('feature_copy'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    featureKey: z.string().min(1).max(160),
                                                    placement: z.string().min(1).max(160),
                                                }),
                                            }),
                                        ].filter((branch) => branch.safeParse(value).success).length === 1,
                                ),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                schemaVersion: z.literal(1),
                                dictionary: z.union([z.literal('category'), z.literal('unit'), z.literal('allergen')]),
                                code: z.string().max(120).regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                                label: z.string().min(1).max(160),
                                description: z.string().max(2000).nullable(),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                sortOrder: z.number().int().min(0).max(1000000),
                                enabled: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                    ]),
                ),
                validation: z.strictObject({
                    valid: z.boolean(),
                    conflicts: z.array(z.string()),
                    errors: z.array(z.string()),
                }),
                ack: z
                    .strictObject({
                        clientRevision: z.number().int().gt(0).max(9007199254740991),
                        checksum: z.string().regex(new RegExp('^[a-f0-9]{64}$', 'u')),
                    })
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/content-releases/{id}/rollback': {
        params: z.strictObject({ id: z.string() }),
        request: z.strictObject({
            expectedVersion: z.number().int().gt(0).max(9007199254740991),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                name: z.string(),
                status: z.union([z.literal('draft'), z.literal('published')]),
                version: z.number().int().gt(0).max(9007199254740991),
                patchCount: z.number().int().min(0).max(9007199254740991),
                createdAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                updatedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                publishedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                sourceReleaseId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                rolledBackFromEventId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                patches: z.array(
                    z.union([
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                code: z.string().min(1).max(160),
                                title: z.string().min(1).max(160),
                                description: z.string().min(1).max(2000),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                category: z.union([
                                    z.literal('culinary'),
                                    z.literal('inventory'),
                                    z.literal('planning'),
                                    z.literal('author'),
                                    z.literal('community'),
                                    z.literal('catalog'),
                                    z.literal('collections'),
                                    z.literal('family'),
                                    z.literal('seasonal'),
                                    z.literal('secret'),
                                ]),
                                condition: z.record(
                                    z.string(),
                                    z.union([
                                        z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                        z
                                            .array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
                                            .max(100),
                                    ]),
                                ),
                                reputationDelta: z.number().int().min(0).max(10000),
                                secret: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                level: z.number().int().min(1).max(10),
                                threshold: z.number().int().min(0).max(1000000000),
                                title: z.string().min(1).max(160),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                kind: z.string().min(1).max(160),
                                content: z.string().min(1).max(200000),
                                effectiveAt: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                productId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                                description: z.string().min(1).max(2000),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z
                                .union([
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('help'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            slug: z.string().min(1).max(160),
                                            audience: z.union([
                                                z.literal('all'),
                                                z.literal('user'),
                                                z.literal('admin'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('pricing'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            plan: z.union([z.literal('free'), z.literal('plus')]),
                                            billingPeriod: z.union([
                                                z.literal('none'),
                                                z.literal('month'),
                                                z.literal('year'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('onboarding'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            flow: z.string().min(1).max(160),
                                            step: z.number().int().gt(0).max(9007199254740991),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('notification_template'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            channel: z.union([
                                                z.literal('in_app'),
                                                z.literal('email'),
                                                z.literal('push'),
                                            ]),
                                            templateKey: z.string().min(1).max(160),
                                            variables: z.array(z.string().min(1).max(160)).max(50),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('feature_copy'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            featureKey: z.string().min(1).max(160),
                                            placement: z.string().min(1).max(160),
                                        }),
                                    }),
                                ])
                                .refine(
                                    (value) =>
                                        [
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('help'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    slug: z.string().min(1).max(160),
                                                    audience: z.union([
                                                        z.literal('all'),
                                                        z.literal('user'),
                                                        z.literal('admin'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('pricing'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    plan: z.union([z.literal('free'), z.literal('plus')]),
                                                    billingPeriod: z.union([
                                                        z.literal('none'),
                                                        z.literal('month'),
                                                        z.literal('year'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('onboarding'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    flow: z.string().min(1).max(160),
                                                    step: z.number().int().gt(0).max(9007199254740991),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('notification_template'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    channel: z.union([
                                                        z.literal('in_app'),
                                                        z.literal('email'),
                                                        z.literal('push'),
                                                    ]),
                                                    templateKey: z.string().min(1).max(160),
                                                    variables: z.array(z.string().min(1).max(160)).max(50),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('feature_copy'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    featureKey: z.string().min(1).max(160),
                                                    placement: z.string().min(1).max(160),
                                                }),
                                            }),
                                        ].filter((branch) => branch.safeParse(value).success).length === 1,
                                ),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                schemaVersion: z.literal(1),
                                dictionary: z.union([z.literal('category'), z.literal('unit'), z.literal('allergen')]),
                                code: z.string().max(120).regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                                label: z.string().min(1).max(160),
                                description: z.string().max(2000).nullable(),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                sortOrder: z.number().int().min(0).max(1000000),
                                enabled: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                    ]),
                ),
                validation: z.strictObject({
                    valid: z.boolean(),
                    conflicts: z.array(z.string()),
                    errors: z.array(z.string()),
                }),
                ack: z
                    .strictObject({
                        clientRevision: z.number().int().gt(0).max(9007199254740991),
                        checksum: z.string().regex(new RegExp('^[a-f0-9]{64}$', 'u')),
                    })
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/content-releases/{id}/edit': {
        params: z.strictObject({ id: z.string() }),
        request: z.strictObject({
            name: z.string().min(1).max(160),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                name: z.string(),
                status: z.union([z.literal('draft'), z.literal('published')]),
                version: z.number().int().gt(0).max(9007199254740991),
                patchCount: z.number().int().min(0).max(9007199254740991),
                createdAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                updatedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                publishedAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
                sourceReleaseId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                rolledBackFromEventId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                patches: z.array(
                    z.union([
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                code: z.string().min(1).max(160),
                                title: z.string().min(1).max(160),
                                description: z.string().min(1).max(2000),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                category: z.union([
                                    z.literal('culinary'),
                                    z.literal('inventory'),
                                    z.literal('planning'),
                                    z.literal('author'),
                                    z.literal('community'),
                                    z.literal('catalog'),
                                    z.literal('collections'),
                                    z.literal('family'),
                                    z.literal('seasonal'),
                                    z.literal('secret'),
                                ]),
                                condition: z.record(
                                    z.string(),
                                    z.union([
                                        z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
                                        z
                                            .array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
                                            .max(100),
                                    ]),
                                ),
                                reputationDelta: z.number().int().min(0).max(10000),
                                secret: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('achievement'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                level: z.number().int().min(1).max(10),
                                threshold: z.number().int().min(0).max(1000000000),
                                title: z.string().min(1).max(160),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('reputation_title'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                kind: z.string().min(1).max(160),
                                content: z.string().min(1).max(200000),
                                effectiveAt: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.iso.datetime()),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('legal_text'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                productId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                                description: z.string().min(1).max(2000),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('product_description'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z
                                .union([
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('help'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            slug: z.string().min(1).max(160),
                                            audience: z.union([
                                                z.literal('all'),
                                                z.literal('user'),
                                                z.literal('admin'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('pricing'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            plan: z.union([z.literal('free'), z.literal('plus')]),
                                            billingPeriod: z.union([
                                                z.literal('none'),
                                                z.literal('month'),
                                                z.literal('year'),
                                            ]),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('onboarding'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            flow: z.string().min(1).max(160),
                                            step: z.number().int().gt(0).max(9007199254740991),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('notification_template'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            channel: z.union([
                                                z.literal('in_app'),
                                                z.literal('email'),
                                                z.literal('push'),
                                            ]),
                                            templateKey: z.string().min(1).max(160),
                                            variables: z.array(z.string().min(1).max(160)).max(50),
                                        }),
                                    }),
                                    z.strictObject({
                                        locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                        title: z.string().min(1).max(160),
                                        body: z.string().min(1).max(200000),
                                        namespace: z.literal('feature_copy'),
                                        metadata: z.strictObject({
                                            schemaVersion: z.literal(1),
                                            featureKey: z.string().min(1).max(160),
                                            placement: z.string().min(1).max(160),
                                        }),
                                    }),
                                ])
                                .refine(
                                    (value) =>
                                        [
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('help'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    slug: z.string().min(1).max(160),
                                                    audience: z.union([
                                                        z.literal('all'),
                                                        z.literal('user'),
                                                        z.literal('admin'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('pricing'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    plan: z.union([z.literal('free'), z.literal('plus')]),
                                                    billingPeriod: z.union([
                                                        z.literal('none'),
                                                        z.literal('month'),
                                                        z.literal('year'),
                                                    ]),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('onboarding'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    flow: z.string().min(1).max(160),
                                                    step: z.number().int().gt(0).max(9007199254740991),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('notification_template'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    channel: z.union([
                                                        z.literal('in_app'),
                                                        z.literal('email'),
                                                        z.literal('push'),
                                                    ]),
                                                    templateKey: z.string().min(1).max(160),
                                                    variables: z.array(z.string().min(1).max(160)).max(50),
                                                }),
                                            }),
                                            z.strictObject({
                                                locale: z.string().regex(new RegExp('^[a-z]{2}(?:-[A-Z]{2})?$', 'u')),
                                                title: z.string().min(1).max(160),
                                                body: z.string().min(1).max(200000),
                                                namespace: z.literal('feature_copy'),
                                                metadata: z.strictObject({
                                                    schemaVersion: z.literal(1),
                                                    featureKey: z.string().min(1).max(160),
                                                    placement: z.string().min(1).max(160),
                                                }),
                                            }),
                                        ].filter((branch) => branch.safeParse(value).success).length === 1,
                                ),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('content_document'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.union([z.literal('create'), z.literal('update')]),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.strictObject({
                                schemaVersion: z.literal(1),
                                dictionary: z.union([z.literal('category'), z.literal('unit'), z.literal('allergen')]),
                                code: z.string().max(120).regex(new RegExp('^[a-z0-9]+(?:[._-][a-z0-9]+)*$', 'u')),
                                label: z.string().min(1).max(160),
                                description: z.string().max(2000).nullable(),
                                icon: z.strictObject({
                                    assetId: z
                                        .string()
                                        .regex(
                                            new RegExp(
                                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                                'u',
                                            ),
                                        )
                                        .pipe(z.uuid())
                                        .nullable(),
                                    fallbackKey: z.string().min(1).max(80),
                                    alt: z.string().min(1).max(200),
                                }),
                                sortOrder: z.number().int().min(0).max(1000000),
                                enabled: z.boolean(),
                            }),
                        }),
                        z.strictObject({
                            patchId: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            expectedVersion: z.number().int().min(0).max(9007199254740991),
                            resourceType: z.literal('dictionary_entry'),
                            action: z.literal('retire'),
                            resourceKey: z.string().min(1).max(160),
                            payload: z.null(),
                        }),
                    ]),
                ),
                validation: z.strictObject({
                    valid: z.boolean(),
                    conflicts: z.array(z.string()),
                    errors: z.array(z.string()),
                }),
                ack: z
                    .strictObject({
                        clientRevision: z.number().int().gt(0).max(9007199254740991),
                        checksum: z.string().regex(new RegExp('^[a-f0-9]{64}$', 'u')),
                    })
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/support/{id}/workspace': {
        params: z.strictObject({ id: z.string().pipe(z.uuid()) }),
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                version: z.string().max(19).regex(new RegExp('^[1-9][0-9]*$', 'u')),
                assigneeId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                staff: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        label: z.string(),
                    }),
                ),
                messages: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        body: z.string(),
                        authorId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        internal: z.boolean(),
                        edited: z.boolean(),
                        canEdit: z.boolean(),
                        revisions: z.array(z.strictObject({ body: z.string(), createdAt: z.string() })),
                    }),
                ),
                attachments: z.array(
                    z.strictObject({
                        name: z.string().min(1).max(200),
                        type: z.union([
                            z.literal('image/jpeg'),
                            z.literal('image/png'),
                            z.literal('image/webp'),
                            z.literal('application/pdf'),
                            z.literal('video/mp4'),
                            z.literal('video/webm'),
                            z.literal('video/quicktime'),
                        ]),
                        size: z.number().int().min(1).max(10485760),
                        duration: z.number().min(0).max(10).nullable(),
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        messageId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        status: z.union([
                            z.literal('uploading'),
                            z.literal('pending'),
                            z.literal('ready'),
                            z.literal('rejected'),
                            z.literal('hidden'),
                        ]),
                        reason: z.string().nullable(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/support/{id}/manage': {
        params: z.strictObject({ id: z.string().pipe(z.uuid()) }),
        request: z.strictObject({
            version: z.string().max(19).regex(new RegExp('^[1-9][0-9]*$', 'u')),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            action: z.union([
                z.literal('assign'),
                z.literal('note'),
                z.literal('edit'),
                z.literal('attach'),
                z.literal('hide'),
            ]),
            targetId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid())
                .nullable(),
            text: z.string().max(10000),
            attachments: z
                .array(
                    z.strictObject({
                        name: z.string().min(1).max(200),
                        type: z.union([
                            z.literal('image/jpeg'),
                            z.literal('image/png'),
                            z.literal('image/webp'),
                            z.literal('application/pdf'),
                            z.literal('video/mp4'),
                            z.literal('video/webm'),
                            z.literal('video/quicktime'),
                        ]),
                        size: z.number().int().min(1).max(10485760),
                        duration: z.number().min(0).max(10).nullable(),
                    }),
                )
                .max(5),
        }),
        success: z.strictObject({
            data: z.strictObject({
                ticketId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string().max(19).regex(new RegExp('^[1-9][0-9]*$', 'u')),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/support/create': {
        params: null,
        request: z.strictObject({
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            requesterId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            subject: z.string().min(1).max(200),
            body: z.string().min(1).max(10000),
        }),
        success: z.strictObject({
            data: z.strictObject({
                ticketId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string().max(19).regex(new RegExp('^[1-9][0-9]*$', 'u')),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/notification-center': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                version: z.number().int().min(1).max(9007199254740991),
                settings: z.strictObject({
                    categories: z.strictObject({
                        security: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                        payments: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                        support: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                        moderation: z.strictObject({
                            browser: z.boolean(),
                            mobilePush: z.boolean(),
                            email: z.boolean(),
                        }),
                        operations: z.strictObject({
                            browser: z.boolean(),
                            mobilePush: z.boolean(),
                            email: z.boolean(),
                        }),
                        campaigns: z.strictObject({
                            browser: z.boolean(),
                            mobilePush: z.boolean(),
                            email: z.boolean(),
                        }),
                    }),
                    quietHours: z.strictObject({
                        start: z.string().regex(new RegExp('^([01]\\d|2[0-3]):[0-5]\\d$', 'u')),
                        end: z.string().regex(new RegExp('^([01]\\d|2[0-3]):[0-5]\\d$', 'u')),
                        timeZone: z.string().min(1).max(100),
                    }),
                    thresholds: z.strictObject({
                        count: z.number().int().min(1).max(100000),
                        windowMinutes: z.number().int().min(1).max(10080),
                        repeatMinutes: z.number().int().min(1).max(10080),
                    }),
                }),
                verifiedEmail: z
                    .string()
                    .regex(
                        new RegExp(
                            "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                            'u',
                        ),
                    )
                    .pipe(z.email())
                    .nullable(),
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        category: z.union([
                            z.literal('security'),
                            z.literal('payments'),
                            z.literal('support'),
                            z.literal('moderation'),
                            z.literal('operations'),
                            z.literal('campaigns'),
                        ]),
                        title: z.string().max(200),
                        summary: z.string().max(1000),
                        createdAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        readAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        occurrences: z.number().int().min(1).max(9007199254740991),
                        destination: z.union([
                            z.literal('/admin/access'),
                            z.literal('/admin/payments'),
                            z.literal('/admin/support'),
                            z.literal('/admin/queues/recipes'),
                            z.literal('/admin/errors'),
                            z.literal('/admin/news'),
                        ]),
                    }),
                ),
                deliveryConnected: z.boolean(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/notification-center/settings': {
        params: null,
        request: z.strictObject({
            expectedVersion: z.number().int().min(1).max(9007199254740991),
            settings: z.strictObject({
                categories: z.strictObject({
                    security: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                    payments: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                    support: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                    moderation: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                    operations: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                    campaigns: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                }),
                quietHours: z.strictObject({
                    start: z.string().regex(new RegExp('^([01]\\d|2[0-3]):[0-5]\\d$', 'u')),
                    end: z.string().regex(new RegExp('^([01]\\d|2[0-3]):[0-5]\\d$', 'u')),
                    timeZone: z.string().min(1).max(100),
                }),
                thresholds: z.strictObject({
                    count: z.number().int().min(1).max(100000),
                    windowMinutes: z.number().int().min(1).max(10080),
                    repeatMinutes: z.number().int().min(1).max(10080),
                }),
            }),
        }),
        success: z.strictObject({
            data: z.strictObject({
                version: z.number().int().min(1).max(9007199254740991),
                settings: z.strictObject({
                    categories: z.strictObject({
                        security: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                        payments: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                        support: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                        moderation: z.strictObject({
                            browser: z.boolean(),
                            mobilePush: z.boolean(),
                            email: z.boolean(),
                        }),
                        operations: z.strictObject({
                            browser: z.boolean(),
                            mobilePush: z.boolean(),
                            email: z.boolean(),
                        }),
                        campaigns: z.strictObject({
                            browser: z.boolean(),
                            mobilePush: z.boolean(),
                            email: z.boolean(),
                        }),
                    }),
                    quietHours: z.strictObject({
                        start: z.string().regex(new RegExp('^([01]\\d|2[0-3]):[0-5]\\d$', 'u')),
                        end: z.string().regex(new RegExp('^([01]\\d|2[0-3]):[0-5]\\d$', 'u')),
                        timeZone: z.string().min(1).max(100),
                    }),
                    thresholds: z.strictObject({
                        count: z.number().int().min(1).max(100000),
                        windowMinutes: z.number().int().min(1).max(10080),
                        repeatMinutes: z.number().int().min(1).max(10080),
                    }),
                }),
                verifiedEmail: z
                    .string()
                    .regex(
                        new RegExp(
                            "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                            'u',
                        ),
                    )
                    .pipe(z.email())
                    .nullable(),
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        category: z.union([
                            z.literal('security'),
                            z.literal('payments'),
                            z.literal('support'),
                            z.literal('moderation'),
                            z.literal('operations'),
                            z.literal('campaigns'),
                        ]),
                        title: z.string().max(200),
                        summary: z.string().max(1000),
                        createdAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        readAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        occurrences: z.number().int().min(1).max(9007199254740991),
                        destination: z.union([
                            z.literal('/admin/access'),
                            z.literal('/admin/payments'),
                            z.literal('/admin/support'),
                            z.literal('/admin/queues/recipes'),
                            z.literal('/admin/errors'),
                            z.literal('/admin/news'),
                        ]),
                    }),
                ),
                deliveryConnected: z.boolean(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/notification-center/read': {
        params: null,
        request: z.strictObject({
            id: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                version: z.number().int().min(1).max(9007199254740991),
                settings: z.strictObject({
                    categories: z.strictObject({
                        security: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                        payments: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                        support: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                        moderation: z.strictObject({
                            browser: z.boolean(),
                            mobilePush: z.boolean(),
                            email: z.boolean(),
                        }),
                        operations: z.strictObject({
                            browser: z.boolean(),
                            mobilePush: z.boolean(),
                            email: z.boolean(),
                        }),
                        campaigns: z.strictObject({
                            browser: z.boolean(),
                            mobilePush: z.boolean(),
                            email: z.boolean(),
                        }),
                    }),
                    quietHours: z.strictObject({
                        start: z.string().regex(new RegExp('^([01]\\d|2[0-3]):[0-5]\\d$', 'u')),
                        end: z.string().regex(new RegExp('^([01]\\d|2[0-3]):[0-5]\\d$', 'u')),
                        timeZone: z.string().min(1).max(100),
                    }),
                    thresholds: z.strictObject({
                        count: z.number().int().min(1).max(100000),
                        windowMinutes: z.number().int().min(1).max(10080),
                        repeatMinutes: z.number().int().min(1).max(10080),
                    }),
                }),
                verifiedEmail: z
                    .string()
                    .regex(
                        new RegExp(
                            "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                            'u',
                        ),
                    )
                    .pipe(z.email())
                    .nullable(),
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        category: z.union([
                            z.literal('security'),
                            z.literal('payments'),
                            z.literal('support'),
                            z.literal('moderation'),
                            z.literal('operations'),
                            z.literal('campaigns'),
                        ]),
                        title: z.string().max(200),
                        summary: z.string().max(1000),
                        createdAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        readAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        occurrences: z.number().int().min(1).max(9007199254740991),
                        destination: z.union([
                            z.literal('/admin/access'),
                            z.literal('/admin/payments'),
                            z.literal('/admin/support'),
                            z.literal('/admin/queues/recipes'),
                            z.literal('/admin/errors'),
                            z.literal('/admin/news'),
                        ]),
                    }),
                ),
                deliveryConnected: z.boolean(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/governance/{section}/{id}': {
        params: z.strictObject({
            section: z.union([z.literal('users'), z.literal('sanctions'), z.literal('access')]),
            id: z.string().pipe(z.uuid()),
        }),
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string(),
                userId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                name: z.string(),
                role: z.string().nullable(),
                soleAdmin: z.boolean(),
                scope: z.string().nullable(),
                endsAt: z.string().nullable(),
                status: z.string(),
                appeals: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.string(),
                        body: z.string(),
                        status: z.string(),
                        response: z.string().nullable(),
                        submittedAt: z.string(),
                        resolvedAt: z.string().nullable(),
                    }),
                ),
                history: z.array(z.strictObject({ action: z.string(), reason: z.string(), at: z.string() })),
                familySubscription: z
                    .strictObject({
                        subscriptionId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        familyId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        familyName: z.string(),
                        candidates: z.array(
                            z.strictObject({
                                userId: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                                displayName: z.string(),
                                login: z.string(),
                            }),
                        ),
                    })
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/governance/{section}/{id}': {
        params: z.strictObject({
            section: z.union([z.literal('users'), z.literal('sanctions'), z.literal('access')]),
            id: z.string().pipe(z.uuid()),
        }),
        request: z.strictObject({
            version: z.string().max(19).regex(new RegExp('^[1-9][0-9]*$', 'u')),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            action: z.union([
                z.literal('ban'),
                z.literal('revoke'),
                z.literal('extend'),
                z.literal('grantModerator'),
                z.literal('revokeRole'),
                z.literal('acceptAppeal'),
                z.literal('rejectAppeal'),
            ]),
            appealId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid())
                .optional(),
            appealVersion: z.string().max(19).regex(new RegExp('^[1-9][0-9]*$', 'u')).optional(),
            category: z
                .union([
                    z.literal('spam'),
                    z.literal('harassment'),
                    z.literal('discrimination'),
                    z.literal('privacy'),
                    z.literal('copyright'),
                    z.literal('dangerous'),
                    z.literal('inappropriate'),
                    z.literal('fraud'),
                    z.literal('evasion'),
                    z.literal('other'),
                    z.literal('rules'),
                ])
                .nullable(),
            scope: z.union([z.literal('account'), z.literal('ai'), z.literal('publications'), z.literal('comments')]),
            startsAt: z
                .string()
                .regex(
                    new RegExp(
                        '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                        'u',
                    ),
                )
                .pipe(z.iso.datetime())
                .nullable(),
            endsAt: z
                .string()
                .regex(
                    new RegExp(
                        '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                        'u',
                    ),
                )
                .pipe(z.iso.datetime())
                .nullable(),
            reason: z.string().min(1).max(5000),
            privateNote: z.string().max(5000),
            allowTemporaryBan: z.boolean(),
            subscriptionDisposition: z.union([z.literal('keep'), z.literal('transfer')]),
            subscriptionRecipientUserId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid())
                .nullable(),
            confirmed: z.literal(true),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/operations-workspace/inspect': {
        params: null,
        request: z.strictObject({
            section: z.union([z.literal('operations'), z.literal('errors')]),
            id: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            action: z.union([z.literal('inspect'), z.literal('preview'), z.literal('execute')]),
            operation: z.union([
                z.literal('retry'),
                z.literal('cancel'),
                z.literal('new'),
                z.literal('in_progress'),
                z.literal('resolved'),
                z.literal('ignored'),
            ]),
            reason: z.string().max(2000),
            ignoreUntil: z
                .string()
                .regex(
                    new RegExp(
                        '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                        'u',
                    ),
                )
                .pipe(z.iso.datetime())
                .nullable(),
            expectedVersion: z.string().max(100),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string(),
                status: z.string(),
                kind: z.string(),
                failure: z.string(),
                allowed: z.array(
                    z.strictObject({
                        operation: z.union([
                            z.literal('retry'),
                            z.literal('cancel'),
                            z.literal('new'),
                            z.literal('in_progress'),
                            z.literal('resolved'),
                            z.literal('ignored'),
                        ]),
                        enabled: z.boolean(),
                        reason: z.string(),
                    }),
                ),
                preview: z.strictObject({ summary: z.string(), critical: z.boolean() }).nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/operations-workspace/preview': {
        params: null,
        request: z.strictObject({
            section: z.union([z.literal('operations'), z.literal('errors')]),
            id: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            action: z.union([z.literal('inspect'), z.literal('preview'), z.literal('execute')]),
            operation: z.union([
                z.literal('retry'),
                z.literal('cancel'),
                z.literal('new'),
                z.literal('in_progress'),
                z.literal('resolved'),
                z.literal('ignored'),
            ]),
            reason: z.string().max(2000),
            ignoreUntil: z
                .string()
                .regex(
                    new RegExp(
                        '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                        'u',
                    ),
                )
                .pipe(z.iso.datetime())
                .nullable(),
            expectedVersion: z.string().max(100),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string(),
                status: z.string(),
                kind: z.string(),
                failure: z.string(),
                allowed: z.array(
                    z.strictObject({
                        operation: z.union([
                            z.literal('retry'),
                            z.literal('cancel'),
                            z.literal('new'),
                            z.literal('in_progress'),
                            z.literal('resolved'),
                            z.literal('ignored'),
                        ]),
                        enabled: z.boolean(),
                        reason: z.string(),
                    }),
                ),
                preview: z.strictObject({ summary: z.string(), critical: z.boolean() }).nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/operations-workspace/execute': {
        params: null,
        request: z.strictObject({
            section: z.union([z.literal('operations'), z.literal('errors')]),
            id: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            action: z.union([z.literal('inspect'), z.literal('preview'), z.literal('execute')]),
            operation: z.union([
                z.literal('retry'),
                z.literal('cancel'),
                z.literal('new'),
                z.literal('in_progress'),
                z.literal('resolved'),
                z.literal('ignored'),
            ]),
            reason: z.string().max(2000),
            ignoreUntil: z
                .string()
                .regex(
                    new RegExp(
                        '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                        'u',
                    ),
                )
                .pipe(z.iso.datetime())
                .nullable(),
            expectedVersion: z.string().max(100),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string(),
                status: z.string(),
                kind: z.string(),
                failure: z.string(),
                allowed: z.array(
                    z.strictObject({
                        operation: z.union([
                            z.literal('retry'),
                            z.literal('cancel'),
                            z.literal('new'),
                            z.literal('in_progress'),
                            z.literal('resolved'),
                            z.literal('ignored'),
                        ]),
                        enabled: z.boolean(),
                        reason: z.string(),
                    }),
                ),
                preview: z.strictObject({ summary: z.string(), critical: z.boolean() }).nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/content-workspace/{section}/{id}': {
        params: z.strictObject({
            section: z.union([z.literal('queues'), z.literal('catalog')]),
            id: z.string().pipe(z.uuid()),
        }),
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([z.literal('queues'), z.literal('catalog')]),
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.number().int().gt(0).max(9007199254740991),
                current: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                pending: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                status: z.string(),
                history: z.array(
                    z.strictObject({
                        action: z.string(),
                        reason: z.string(),
                        actor: z.string(),
                        at: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
                cards: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        name: z.string(),
                        fields: z.record(z.string(), z.string().nullable()),
                        variants: z.array(z.string()),
                        authors: z.array(z.string()),
                        sources: z.array(z.string()),
                        aliasOf: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid())
                            .nullable(),
                    }),
                ),
                comparison: z
                    .strictObject({
                        left: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        right: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        conflicts: z.array(z.string()),
                        blockedReason: z.string().nullable(),
                        resolved: z.record(z.string(), z.string().nullable()),
                        canonicalId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        previewKey: z.string(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/content-workspace/{section}/{id}/moderate': {
        params: z.strictObject({
            section: z.union([z.literal('queues'), z.literal('catalog')]),
            id: z.string().pipe(z.uuid()),
        }),
        request: z.strictObject({
            action: z.union([z.literal('approve'), z.literal('reject'), z.literal('hide'), z.literal('unpublish')]),
            version: z.number().int().gt(0).max(9007199254740991),
            reason: z.string().max(2000),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([z.literal('queues'), z.literal('catalog')]),
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.number().int().gt(0).max(9007199254740991),
                current: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                pending: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                status: z.string(),
                history: z.array(
                    z.strictObject({
                        action: z.string(),
                        reason: z.string(),
                        actor: z.string(),
                        at: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
                cards: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        name: z.string(),
                        fields: z.record(z.string(), z.string().nullable()),
                        variants: z.array(z.string()),
                        authors: z.array(z.string()),
                        sources: z.array(z.string()),
                        aliasOf: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid())
                            .nullable(),
                    }),
                ),
                comparison: z
                    .strictObject({
                        left: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        right: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        conflicts: z.array(z.string()),
                        blockedReason: z.string().nullable(),
                        resolved: z.record(z.string(), z.string().nullable()),
                        canonicalId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        previewKey: z.string(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/content-workspace/{section}/{id}/compare': {
        params: z.strictObject({
            section: z.union([z.literal('queues'), z.literal('catalog')]),
            id: z.string().pipe(z.uuid()),
        }),
        request: z.strictObject({
            leftId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            rightId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            leftVersion: z.number().int().gt(0).max(9007199254740991),
            rightVersion: z.number().int().gt(0).max(9007199254740991),
            canonicalId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            choices: z.record(z.string(), z.union([z.literal('left'), z.literal('right')])),
        }),
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([z.literal('queues'), z.literal('catalog')]),
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.number().int().gt(0).max(9007199254740991),
                current: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                pending: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                status: z.string(),
                history: z.array(
                    z.strictObject({
                        action: z.string(),
                        reason: z.string(),
                        actor: z.string(),
                        at: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
                cards: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        name: z.string(),
                        fields: z.record(z.string(), z.string().nullable()),
                        variants: z.array(z.string()),
                        authors: z.array(z.string()),
                        sources: z.array(z.string()),
                        aliasOf: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid())
                            .nullable(),
                    }),
                ),
                comparison: z
                    .strictObject({
                        left: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        right: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        conflicts: z.array(z.string()),
                        blockedReason: z.string().nullable(),
                        resolved: z.record(z.string(), z.string().nullable()),
                        canonicalId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        previewKey: z.string(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/content-workspace/{section}/{id}/merge': {
        params: z.strictObject({
            section: z.union([z.literal('queues'), z.literal('catalog')]),
            id: z.string().pipe(z.uuid()),
        }),
        request: z.strictObject({
            leftId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            rightId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            leftVersion: z.number().int().gt(0).max(9007199254740991),
            rightVersion: z.number().int().gt(0).max(9007199254740991),
            canonicalId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            choices: z.record(z.string(), z.union([z.literal('left'), z.literal('right')])),
            previewKey: z.string().min(1),
            reason: z.string().min(1).max(2000),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([z.literal('queues'), z.literal('catalog')]),
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.number().int().gt(0).max(9007199254740991),
                current: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                pending: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                status: z.string(),
                history: z.array(
                    z.strictObject({
                        action: z.string(),
                        reason: z.string(),
                        actor: z.string(),
                        at: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
                cards: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        name: z.string(),
                        fields: z.record(z.string(), z.string().nullable()),
                        variants: z.array(z.string()),
                        authors: z.array(z.string()),
                        sources: z.array(z.string()),
                        aliasOf: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid())
                            .nullable(),
                    }),
                ),
                comparison: z
                    .strictObject({
                        left: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        right: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        conflicts: z.array(z.string()),
                        blockedReason: z.string().nullable(),
                        resolved: z.record(z.string(), z.string().nullable()),
                        canonicalId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        previewKey: z.string(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/content-workspace/{section}/{id}/not-duplicate': {
        params: z.strictObject({
            section: z.union([z.literal('queues'), z.literal('catalog')]),
            id: z.string().pipe(z.uuid()),
        }),
        request: z.strictObject({
            leftId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            rightId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            leftVersion: z.number().int().gt(0).max(9007199254740991),
            rightVersion: z.number().int().gt(0).max(9007199254740991),
            reason: z.string().min(1).max(2000),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([z.literal('queues'), z.literal('catalog')]),
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.number().int().gt(0).max(9007199254740991),
                current: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                pending: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        fields: z.record(z.string(), z.string().nullable()),
                    })
                    .nullable(),
                status: z.string(),
                history: z.array(
                    z.strictObject({
                        action: z.string(),
                        reason: z.string(),
                        actor: z.string(),
                        at: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
                cards: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        version: z.number().int().gt(0).max(9007199254740991),
                        name: z.string(),
                        fields: z.record(z.string(), z.string().nullable()),
                        variants: z.array(z.string()),
                        authors: z.array(z.string()),
                        sources: z.array(z.string()),
                        aliasOf: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid())
                            .nullable(),
                    }),
                ),
                comparison: z
                    .strictObject({
                        left: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        right: z.strictObject({
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                            version: z.number().int().gt(0).max(9007199254740991),
                            name: z.string(),
                            fields: z.record(z.string(), z.string().nullable()),
                            variants: z.array(z.string()),
                            authors: z.array(z.string()),
                            sources: z.array(z.string()),
                            aliasOf: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid())
                                .nullable(),
                        }),
                        conflicts: z.array(z.string()),
                        blockedReason: z.string().nullable(),
                        resolved: z.record(z.string(), z.string().nullable()),
                        canonicalId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        previewKey: z.string(),
                    })
                    .nullable(),
                message: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/billing/{section}/{id}': {
        params: z.strictObject({
            id: z.string().pipe(z.uuid()),
            section: z.union([z.literal('users'), z.literal('subscriptions'), z.literal('payments')]),
        }),
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string(),
                ownerId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                payerId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                plan: z.string(),
                status: z.string(),
                frozen: z.boolean(),
                quota: z.number().int().min(0).max(9007199254740991),
                refreshAt: z.string().nullable(),
                periods: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        source: z.union([z.literal('paid'), z.literal('gift')]),
                        startsAt: z.string(),
                        endsAt: z.string(),
                        revoked: z.boolean(),
                    }),
                ),
                payment: z
                    .strictObject({
                        paidMinor: z.string(),
                        returnedMinor: z.string(),
                        reservedMinor: z.string(),
                        currency: z.literal('RUB'),
                        status: z.string(),
                        targetId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        targetKind: z.union([z.literal('period'), z.literal('package')]),
                        packageRemaining: z.number().int().min(0).max(9007199254740991).nullable(),
                    })
                    .nullable(),
                history: z.array(z.strictObject({ action: z.string(), reason: z.string(), at: z.string() })),
                notice: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/billing/{section}/{id}': {
        params: z.strictObject({
            id: z.string().pipe(z.uuid()),
            section: z.union([z.literal('users'), z.literal('subscriptions'), z.literal('payments')]),
        }),
        request: z.strictObject({
            version: z.string().max(19).regex(new RegExp('^[1-9][0-9]*$', 'u')),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            action: z.union([
                z.literal('grant'),
                z.literal('extend'),
                z.literal('revokeGift'),
                z.literal('freeze'),
                z.literal('unfreeze'),
                z.literal('refund'),
            ]),
            plan: z.union([z.literal('plus'), z.literal('pro')]),
            until: z
                .string()
                .regex(
                    new RegExp(
                        '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                        'u',
                    ),
                )
                .pipe(z.iso.datetime())
                .nullable(),
            targetId: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid())
                .nullable(),
            amountMinor: z.string().max(16).regex(new RegExp('^[1-9][0-9]*$', 'u')).nullable(),
            effect: z.union([z.literal('preserve'), z.literal('terminate')]),
            reason: z.string().min(1).max(5000),
            confirmed: z.literal(true),
            accessConfirmed: z.boolean(),
        }),
        success: z.strictObject({
            data: z.strictObject({
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string(),
                status: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/review-workspace/{section}/{id}': {
        params: z.strictObject({
            id: z.string().pipe(z.uuid()),
            section: z.union([z.literal('legal-requests'), z.literal('rollback')]),
        }),
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([z.literal('legal-requests'), z.literal('rollback')]),
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.number().int().gt(0).max(9007199254740991),
                status: z.string(),
                requesterId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                identityVerified: z.boolean(),
                identityEvidence: z.string().nullable(),
                dependencies: z.array(
                    z.strictObject({
                        label: z.string(),
                        state: z.union([z.literal('ready'), z.literal('blocked'), z.literal('info')]),
                        detail: z.string(),
                    }),
                ),
                exportData: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        expiresAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        status: z.union([z.literal('ready'), z.literal('expired')]),
                        sections: z.array(z.string()),
                    })
                    .nullable(),
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        targetId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        before: z.string(),
                        after: z.string(),
                        current: z.string(),
                        expectedVersion: z.number().int().min(-9007199254740991).max(9007199254740991),
                        actualVersion: z.number().int().min(-9007199254740991).max(9007199254740991),
                        state: z.union([
                            z.literal('ready'),
                            z.literal('conflict'),
                            z.literal('blocked'),
                            z.literal('applied'),
                        ]),
                        reason: z.string(),
                    }),
                ),
                history: z.array(
                    z.strictObject({
                        action: z.string(),
                        reason: z.string(),
                        actor: z.string(),
                        at: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
                previewKey: z.string().nullable(),
                message: z.string(),
                relatedRequests: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        label: z.string(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/review-workspace/{section}/{id}/preview': {
        params: z.strictObject({
            id: z.string().pipe(z.uuid()),
            section: z.union([z.literal('legal-requests'), z.literal('rollback')]),
        }),
        request: z.strictObject({ version: z.number().int().gt(0).max(9007199254740991) }),
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([z.literal('legal-requests'), z.literal('rollback')]),
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.number().int().gt(0).max(9007199254740991),
                status: z.string(),
                requesterId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                identityVerified: z.boolean(),
                identityEvidence: z.string().nullable(),
                dependencies: z.array(
                    z.strictObject({
                        label: z.string(),
                        state: z.union([z.literal('ready'), z.literal('blocked'), z.literal('info')]),
                        detail: z.string(),
                    }),
                ),
                exportData: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        expiresAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        status: z.union([z.literal('ready'), z.literal('expired')]),
                        sections: z.array(z.string()),
                    })
                    .nullable(),
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        targetId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        before: z.string(),
                        after: z.string(),
                        current: z.string(),
                        expectedVersion: z.number().int().min(-9007199254740991).max(9007199254740991),
                        actualVersion: z.number().int().min(-9007199254740991).max(9007199254740991),
                        state: z.union([
                            z.literal('ready'),
                            z.literal('conflict'),
                            z.literal('blocked'),
                            z.literal('applied'),
                        ]),
                        reason: z.string(),
                    }),
                ),
                history: z.array(
                    z.strictObject({
                        action: z.string(),
                        reason: z.string(),
                        actor: z.string(),
                        at: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
                previewKey: z.string().nullable(),
                message: z.string(),
                relatedRequests: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        label: z.string(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/review-workspace/{section}/{id}/prepare-export': {
        params: z.strictObject({
            id: z.string().pipe(z.uuid()),
            section: z.union([z.literal('legal-requests'), z.literal('rollback')]),
        }),
        request: z.strictObject({
            version: z.number().int().gt(0).max(9007199254740991),
            previewKey: z.string().min(1),
            reason: z.string().min(1).max(2000),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([z.literal('legal-requests'), z.literal('rollback')]),
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.number().int().gt(0).max(9007199254740991),
                status: z.string(),
                requesterId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                identityVerified: z.boolean(),
                identityEvidence: z.string().nullable(),
                dependencies: z.array(
                    z.strictObject({
                        label: z.string(),
                        state: z.union([z.literal('ready'), z.literal('blocked'), z.literal('info')]),
                        detail: z.string(),
                    }),
                ),
                exportData: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        expiresAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        status: z.union([z.literal('ready'), z.literal('expired')]),
                        sections: z.array(z.string()),
                    })
                    .nullable(),
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        targetId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        before: z.string(),
                        after: z.string(),
                        current: z.string(),
                        expectedVersion: z.number().int().min(-9007199254740991).max(9007199254740991),
                        actualVersion: z.number().int().min(-9007199254740991).max(9007199254740991),
                        state: z.union([
                            z.literal('ready'),
                            z.literal('conflict'),
                            z.literal('blocked'),
                            z.literal('applied'),
                        ]),
                        reason: z.string(),
                    }),
                ),
                history: z.array(
                    z.strictObject({
                        action: z.string(),
                        reason: z.string(),
                        actor: z.string(),
                        at: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
                previewKey: z.string().nullable(),
                message: z.string(),
                relatedRequests: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        label: z.string(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/review-workspace/{section}/{id}/apply-rollback': {
        params: z.strictObject({
            id: z.string().pipe(z.uuid()),
            section: z.union([z.literal('legal-requests'), z.literal('rollback')]),
        }),
        request: z.strictObject({
            version: z.number().int().gt(0).max(9007199254740991),
            previewKey: z.string().min(1),
            reason: z.string().min(1).max(2000),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([z.literal('legal-requests'), z.literal('rollback')]),
                id: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.number().int().gt(0).max(9007199254740991),
                status: z.string(),
                requesterId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                identityVerified: z.boolean(),
                identityEvidence: z.string().nullable(),
                dependencies: z.array(
                    z.strictObject({
                        label: z.string(),
                        state: z.union([z.literal('ready'), z.literal('blocked'), z.literal('info')]),
                        detail: z.string(),
                    }),
                ),
                exportData: z
                    .strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        expiresAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        status: z.union([z.literal('ready'), z.literal('expired')]),
                        sections: z.array(z.string()),
                    })
                    .nullable(),
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        targetId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        before: z.string(),
                        after: z.string(),
                        current: z.string(),
                        expectedVersion: z.number().int().min(-9007199254740991).max(9007199254740991),
                        actualVersion: z.number().int().min(-9007199254740991).max(9007199254740991),
                        state: z.union([
                            z.literal('ready'),
                            z.literal('conflict'),
                            z.literal('blocked'),
                            z.literal('applied'),
                        ]),
                        reason: z.string(),
                    }),
                ),
                history: z.array(
                    z.strictObject({
                        action: z.string(),
                        reason: z.string(),
                        actor: z.string(),
                        at: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                    }),
                ),
                previewKey: z.string().nullable(),
                message: z.string(),
                relatedRequests: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        label: z.string(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/auth/csrf': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ token: z.string() }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/auth/login': {
        params: null,
        request: z.strictObject({
            login: z.string().regex(new RegExp('^[A-Za-z0-9_]{3,30}$', 'u')),
            password: z.string().min(1).max(1024),
            context: z.literal('admin'),
        }),
        success: z.strictObject({
            data: z.strictObject({
                status: z.literal('mfa_required'),
                challenge: z.string(),
                expiresAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                enrollment: z.strictObject({ secret: z.string(), uri: z.string() }).nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/auth/mfa/verify': {
        params: null,
        request: z.strictObject({
            challenge: z.string().regex(new RegExp('^[A-Za-z0-9_-]{43}$', 'u')),
            code: z.string().min(6).max(64),
            method: z.union([z.literal('totp'), z.literal('recovery')]),
        }),
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
                recoveryCodes: z.array(z.string()),
                unlockToken: z.string(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/auth/status': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
                status: z.union([z.literal('locked'), z.literal('unlocked')]),
                criticalUntil: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/auth/unlock': {
        params: null,
        request: z.strictObject({
            code: z.string().min(6).max(64),
            method: z.union([z.literal('totp'), z.literal('recovery')]),
        }),
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
                unlockToken: z.string(),
                criticalUntil: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime())
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/auth/critical-confirm': {
        params: null,
        request: z.strictObject({
            code: z.string().min(6).max(64),
            method: z.union([z.literal('totp'), z.literal('recovery')]),
        }),
        success: z.strictObject({
            data: z.strictObject({
                criticalUntil: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/auth/me': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/auth/sessions': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                sessions: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                        authenticatedAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        expiresAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        current: z.boolean(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/auth/sessions/revoke-others': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ revokedCount: z.number().int().min(0).max(9007199254740991) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/auth/logout': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ loggedOut: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/{section}/{id}/related/{collection}/search': {
        params: z.strictObject({
            section: z.union([
                z.literal('overview'),
                z.literal('queues'),
                z.literal('users'),
                z.literal('sanctions'),
                z.literal('subscriptions'),
                z.literal('families'),
                z.literal('payments'),
                z.literal('support'),
                z.literal('catalog'),
                z.literal('news'),
                z.literal('audit'),
                z.literal('rollback'),
                z.literal('legal-requests'),
                z.literal('operations'),
                z.literal('errors'),
                z.literal('metrics'),
                z.literal('access'),
            ]),
            id: z.string().pipe(z.uuid()),
            collection: z.string().regex(new RegExp('^[a-z][a-z-]{0,63}$', 'u')),
        }),
        request: z.strictObject({
            cursor: z.string().max(1500).regex(new RegExp('^[A-Za-z0-9_-]+$', 'u')).optional(),
            limit: z.number().int().min(1).max(50).optional(),
        }),
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        title: z.string(),
                        status: z.string().nullable(),
                        updatedAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        version: z.string(),
                        fields: z.array(
                            z.strictObject({ key: z.string(), label: z.string(), value: z.string().nullable() }),
                        ),
                        related: z.array(
                            z.strictObject({
                                label: z.string(),
                                section: z.union([
                                    z.literal('overview'),
                                    z.literal('queues'),
                                    z.literal('users'),
                                    z.literal('sanctions'),
                                    z.literal('subscriptions'),
                                    z.literal('families'),
                                    z.literal('payments'),
                                    z.literal('support'),
                                    z.literal('catalog'),
                                    z.literal('news'),
                                    z.literal('audit'),
                                    z.literal('rollback'),
                                    z.literal('legal-requests'),
                                    z.literal('operations'),
                                    z.literal('errors'),
                                    z.literal('metrics'),
                                    z.literal('access'),
                                ]),
                                id: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                            }),
                        ),
                        actions: z.array(
                            z.strictObject({
                                key: z.string(),
                                label: z.string(),
                                enabled: z.boolean(),
                                reason: z.string().nullable(),
                            }),
                        ),
                    }),
                ),
                nextCursor: z.string().nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/{section}/search': {
        params: z.strictObject({
            section: z.union([
                z.literal('overview'),
                z.literal('queues'),
                z.literal('users'),
                z.literal('sanctions'),
                z.literal('subscriptions'),
                z.literal('families'),
                z.literal('payments'),
                z.literal('support'),
                z.literal('catalog'),
                z.literal('news'),
                z.literal('audit'),
                z.literal('rollback'),
                z.literal('legal-requests'),
                z.literal('operations'),
                z.literal('errors'),
                z.literal('metrics'),
                z.literal('access'),
            ]),
        }),
        request: z.strictObject({
            queue: z.literal('recipes').optional(),
            query: z.string().max(100).optional(),
            status: z.string().max(64).optional(),
            cursor: z.string().max(1500).regex(new RegExp('^[A-Za-z0-9_-]+$', 'u')).optional(),
            limit: z.number().int().min(1).max(50).optional(),
        }),
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([
                    z.literal('overview'),
                    z.literal('queues'),
                    z.literal('users'),
                    z.literal('sanctions'),
                    z.literal('subscriptions'),
                    z.literal('families'),
                    z.literal('payments'),
                    z.literal('support'),
                    z.literal('catalog'),
                    z.literal('news'),
                    z.literal('audit'),
                    z.literal('rollback'),
                    z.literal('legal-requests'),
                    z.literal('operations'),
                    z.literal('errors'),
                    z.literal('metrics'),
                    z.literal('access'),
                ]),
                availability: z.union([z.literal('available'), z.literal('unavailable'), z.literal('requires_query')]),
                reason: z.string().nullable(),
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        title: z.string(),
                        status: z.string().nullable(),
                        updatedAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime())
                            .nullable(),
                        version: z.string(),
                        fields: z.array(
                            z.strictObject({ key: z.string(), label: z.string(), value: z.string().nullable() }),
                        ),
                        related: z.array(
                            z.strictObject({
                                label: z.string(),
                                section: z.union([
                                    z.literal('overview'),
                                    z.literal('queues'),
                                    z.literal('users'),
                                    z.literal('sanctions'),
                                    z.literal('subscriptions'),
                                    z.literal('families'),
                                    z.literal('payments'),
                                    z.literal('support'),
                                    z.literal('catalog'),
                                    z.literal('news'),
                                    z.literal('audit'),
                                    z.literal('rollback'),
                                    z.literal('legal-requests'),
                                    z.literal('operations'),
                                    z.literal('errors'),
                                    z.literal('metrics'),
                                    z.literal('access'),
                                ]),
                                id: z
                                    .string()
                                    .regex(
                                        new RegExp(
                                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                            'u',
                                        ),
                                    )
                                    .pipe(z.uuid()),
                            }),
                        ),
                        actions: z.array(
                            z.strictObject({
                                key: z.string(),
                                label: z.string(),
                                enabled: z.boolean(),
                                reason: z.string().nullable(),
                            }),
                        ),
                    }),
                ),
                nextCursor: z.string().nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/{section}/{id}': {
        params: z.strictObject({
            section: z.union([
                z.literal('overview'),
                z.literal('queues'),
                z.literal('users'),
                z.literal('sanctions'),
                z.literal('subscriptions'),
                z.literal('families'),
                z.literal('payments'),
                z.literal('support'),
                z.literal('catalog'),
                z.literal('news'),
                z.literal('audit'),
                z.literal('rollback'),
                z.literal('legal-requests'),
                z.literal('operations'),
                z.literal('errors'),
                z.literal('metrics'),
                z.literal('access'),
            ]),
            id: z.string().pipe(z.uuid()),
        }),
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                section: z.union([
                    z.literal('overview'),
                    z.literal('queues'),
                    z.literal('users'),
                    z.literal('sanctions'),
                    z.literal('subscriptions'),
                    z.literal('families'),
                    z.literal('payments'),
                    z.literal('support'),
                    z.literal('catalog'),
                    z.literal('news'),
                    z.literal('audit'),
                    z.literal('rollback'),
                    z.literal('legal-requests'),
                    z.literal('operations'),
                    z.literal('errors'),
                    z.literal('metrics'),
                    z.literal('access'),
                ]),
                item: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    title: z.string(),
                    status: z.string().nullable(),
                    updatedAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime())
                        .nullable(),
                    version: z.string(),
                    fields: z.array(
                        z.strictObject({ key: z.string(), label: z.string(), value: z.string().nullable() }),
                    ),
                    related: z.array(
                        z.strictObject({
                            label: z.string(),
                            section: z.union([
                                z.literal('overview'),
                                z.literal('queues'),
                                z.literal('users'),
                                z.literal('sanctions'),
                                z.literal('subscriptions'),
                                z.literal('families'),
                                z.literal('payments'),
                                z.literal('support'),
                                z.literal('catalog'),
                                z.literal('news'),
                                z.literal('audit'),
                                z.literal('rollback'),
                                z.literal('legal-requests'),
                                z.literal('operations'),
                                z.literal('errors'),
                                z.literal('metrics'),
                                z.literal('access'),
                            ]),
                            id: z
                                .string()
                                .regex(
                                    new RegExp(
                                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                        'u',
                                    ),
                                )
                                .pipe(z.uuid()),
                        }),
                    ),
                    actions: z.array(
                        z.strictObject({
                            key: z.string(),
                            label: z.string(),
                            enabled: z.boolean(),
                            reason: z.string().nullable(),
                        }),
                    ),
                }),
                collections: z.array(z.strictObject({ key: z.string(), label: z.string() })),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/admin/notification-preferences': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                preferences: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                verifiedEmail: z
                    .string()
                    .regex(
                        new RegExp(
                            "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                            'u',
                        ),
                    )
                    .pipe(z.email())
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/notification-preferences': {
        params: null,
        request: z.strictObject({
            channel: z.union([z.literal('browser'), z.literal('mobilePush'), z.literal('email')]),
            enabled: z.boolean(),
        }),
        success: z.strictObject({
            data: z.strictObject({
                preferences: z.strictObject({ browser: z.boolean(), mobilePush: z.boolean(), email: z.boolean() }),
                verifiedEmail: z
                    .string()
                    .regex(
                        new RegExp(
                            "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                            'u',
                        ),
                    )
                    .pipe(z.email())
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/support/{id}/reply': {
        params: z.strictObject({ id: z.string().pipe(z.uuid()) }),
        request: z.strictObject({
            version: z.string().max(19).regex(new RegExp('^[1-9][0-9]*$', 'u')),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
            body: z.string().min(1).max(10000),
        }),
        success: z.strictObject({
            data: z.strictObject({
                ticketId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string(),
                status: z.string(),
                assigneeId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                messageId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/support/{id}/reopen': {
        params: z.strictObject({ id: z.string().pipe(z.uuid()) }),
        request: z.strictObject({
            version: z.string().max(19).regex(new RegExp('^[1-9][0-9]*$', 'u')),
            idempotencyKey: z
                .string()
                .regex(
                    new RegExp(
                        '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                        'u',
                    ),
                )
                .pipe(z.uuid()),
        }),
        success: z.strictObject({
            data: z.strictObject({
                ticketId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
                version: z.string(),
                status: z.string(),
                assigneeId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
                messageId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid())
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/support/{id}/messages/search': {
        params: z.strictObject({ id: z.string().pipe(z.uuid()) }),
        request: z.strictObject({
            cursor: z.string().max(1500).regex(new RegExp('^[A-Za-z0-9_-]+$', 'u')).optional(),
            limit: z.number().int().min(1).max(50).default(25).optional(),
        }),
        success: z.strictObject({
            data: z.strictObject({
                items: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        body: z.string(),
                        authorId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        createdAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        internal: z.literal(false),
                    }),
                ),
                nextCursor: z.string().nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/register': {
        params: null,
        request: z.strictObject({
            username: z.string().regex(new RegExp('^[A-Za-z0-9_]{3,30}$', 'u')),
            displayName: z.string().min(1).max(100),
            email: z
                .string()
                .max(254)
                .regex(
                    new RegExp(
                        "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                        'u',
                    ),
                )
                .pipe(z.email()),
            password: z
                .string()
                .min(12)
                .max(128)
                .regex(
                    new RegExp(
                        '^(?=[\\s\\S]*\\p{Ll})(?=[\\s\\S]*\\p{Lu})(?=[\\s\\S]*\\p{N})(?=[\\s\\S]*[^\\p{L}\\p{N}\\s])[\\s\\S]*$',
                        'u',
                    ),
                ),
            acceptTerms: z.literal(true),
            acceptPrivacy: z.literal(true),
        }),
        success: z.strictObject({
            data: z.strictObject({ accepted: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/register/v2': {
        params: null,
        request: z.strictObject({
            username: z.string().regex(new RegExp('^[A-Za-z0-9_]{3,30}$', 'u')),
            displayName: z.string().min(1).max(100),
            email: z
                .string()
                .max(254)
                .regex(
                    new RegExp(
                        "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                        'u',
                    ),
                )
                .pipe(z.email()),
            password: z
                .string()
                .min(12)
                .max(128)
                .regex(
                    new RegExp(
                        '^(?=[\\s\\S]*\\p{Ll})(?=[\\s\\S]*\\p{Lu})(?=[\\s\\S]*\\p{N})(?=[\\s\\S]*[^\\p{L}\\p{N}\\s])[\\s\\S]*$',
                        'u',
                    ),
                ),
            legal: z.strictObject({
                offerAcceptance: z.strictObject({
                    accepted: z.literal(true),
                    document: z.strictObject({
                        documentId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        documentVersion: z.number().int().gt(0).max(9007199254740991),
                        bodyHash: z.string().regex(new RegExp('^sha256:[a-f0-9]{64}$', 'u')),
                        contentReleaseId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        publishEventId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                    }),
                }),
                privacyAcknowledgement: z.strictObject({
                    acknowledged: z.literal(true),
                    document: z.strictObject({
                        documentId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        documentVersion: z.number().int().gt(0).max(9007199254740991),
                        bodyHash: z.string().regex(new RegExp('^sha256:[a-f0-9]{64}$', 'u')),
                        contentReleaseId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        publishEventId: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                    }),
                }),
            }),
        }),
        success: z.strictObject({
            data: z.strictObject({ accepted: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/email/verify': {
        params: null,
        request: z.strictObject({ token: z.string().regex(new RegExp('^[A-Za-z0-9_-]{43}$', 'u')) }),
        success: z.strictObject({
            data: z.strictObject({ verified: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/email/resend': {
        params: null,
        request: z.strictObject({
            email: z
                .string()
                .max(254)
                .regex(
                    new RegExp(
                        "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                        'u',
                    ),
                )
                .pipe(z.email()),
        }),
        success: z.strictObject({
            data: z.strictObject({ accepted: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/password/recovery': {
        params: null,
        request: z.strictObject({
            email: z
                .string()
                .max(254)
                .regex(
                    new RegExp(
                        "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                        'u',
                    ),
                )
                .pipe(z.email()),
        }),
        success: z.strictObject({
            data: z.strictObject({ accepted: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/password/reset/check': {
        params: null,
        request: z.strictObject({ token: z.string().regex(new RegExp('^[A-Za-z0-9_-]{43}$', 'u')) }),
        success: z.strictObject({
            data: z.strictObject({ valid: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/password/reset': {
        params: null,
        request: z.strictObject({
            token: z.string().regex(new RegExp('^[A-Za-z0-9_-]{43}$', 'u')),
            password: z
                .string()
                .min(12)
                .max(128)
                .regex(
                    new RegExp(
                        '^(?=[\\s\\S]*\\p{Ll})(?=[\\s\\S]*\\p{Lu})(?=[\\s\\S]*\\p{N})(?=[\\s\\S]*[^\\p{L}\\p{N}\\s])[\\s\\S]*$',
                        'u',
                    ),
                ),
        }),
        success: z.strictObject({
            data: z.strictObject({ changed: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/password/change': {
        params: null,
        request: z.strictObject({
            currentPassword: z.string().min(1).max(1024),
            password: z
                .string()
                .min(12)
                .max(128)
                .regex(
                    new RegExp(
                        '^(?=[\\s\\S]*\\p{Ll})(?=[\\s\\S]*\\p{Lu})(?=[\\s\\S]*\\p{N})(?=[\\s\\S]*[^\\p{L}\\p{N}\\s])[\\s\\S]*$',
                        'u',
                    ),
                ),
        }),
        success: z.strictObject({
            data: z.strictObject({ changed: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/email/change': {
        params: null,
        request: z.strictObject({
            password: z.string().min(1).max(1024),
            email: z
                .string()
                .max(254)
                .regex(
                    new RegExp(
                        "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                        'u',
                    ),
                )
                .pipe(z.email()),
        }),
        success: z.strictObject({
            data: z.strictObject({ accepted: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/email/change/confirm': {
        params: null,
        request: z.strictObject({ token: z.string().regex(new RegExp('^[A-Za-z0-9_-]{43}$', 'u')) }),
        success: z.strictObject({
            data: z.strictObject({ confirmed: z.literal(true), effectiveAt: z.string() }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/email/change/cancel': {
        params: null,
        request: z.strictObject({ token: z.string().regex(new RegExp('^[A-Za-z0-9_-]{43}$', 'u')) }),
        success: z.strictObject({
            data: z.strictObject({ cancelled: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/totp/login': {
        params: null,
        request: z.strictObject({
            email: z
                .string()
                .max(254)
                .regex(
                    new RegExp(
                        "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                        'u',
                    ),
                )
                .pipe(z.email()),
            code: z.string().regex(new RegExp('^\\d{6}$', 'u')),
        }),
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/pin/setup': {
        params: null,
        request: z.strictObject({
            password: z.string().min(1).max(1024),
            pin: z.string().regex(new RegExp('^\\d{6}$', 'u')),
        }),
        success: z.strictObject({
            data: z.strictObject({ enabled: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/pin/login': {
        params: null,
        request: z.strictObject({ pin: z.string().regex(new RegExp('^\\d{6}$', 'u')) }),
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/pin/revoke': {
        params: null,
        request: z.strictObject({}),
        success: z.strictObject({
            data: z.strictObject({ revoked: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/auth/security': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                authenticatorEnabled: z.boolean(),
                pinEnabled: z.boolean(),
                pendingEmail: z
                    .strictObject({ email: z.string(), effectiveAt: z.string().nullable(), confirmed: z.boolean() })
                    .nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/authenticator/setup': {
        params: null,
        request: z.strictObject({
            password: z.string().min(1).max(1024),
            proof: z
                .strictObject({
                    method: z.union([z.literal('totp'), z.literal('recovery')]),
                    code: z.string().min(6).max(64),
                })
                .optional(),
        }),
        success: z.strictObject({
            data: z.strictObject({
                challenge: z.string().regex(new RegExp('^[A-Za-z0-9_-]{43}$', 'u')),
                expiresAt: z.string(),
                enrollment: z.strictObject({ secret: z.string(), uri: z.string() }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/authenticator/confirm': {
        params: null,
        request: z.strictObject({
            challenge: z.string().regex(new RegExp('^[A-Za-z0-9_-]{43}$', 'u')),
            code: z.string().regex(new RegExp('^\\d{6}$', 'u')),
        }),
        success: z.strictObject({
            data: z.strictObject({ enabled: z.literal(true), recoveryCodes: z.array(z.string()) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/authenticator/recovery-codes': {
        params: null,
        request: z.strictObject({
            password: z.string().min(1).max(1024),
            proof: z.strictObject({
                method: z.union([z.literal('totp'), z.literal('recovery')]),
                code: z.string().min(6).max(64),
            }),
        }),
        success: z.strictObject({
            data: z.strictObject({ recoveryCodes: z.array(z.string()) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /health/live': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ status: z.literal('ok') }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /health/ready': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ status: z.literal('ok') }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/auth/csrf': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ token: z.string() }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/login': {
        params: null,
        request: z.strictObject({
            email: z
                .string()
                .max(254)
                .regex(
                    new RegExp(
                        "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                        'u',
                    ),
                )
                .pipe(z.email()),
            password: z.string().min(1).max(1024),
        }),
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/auth/me': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/auth/sessions': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                sessions: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                        authenticatedAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        expiresAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        current: z.boolean(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/sessions/revoke-others': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ revokedCount: z.number().int().min(0).max(9007199254740991) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/auth/logout': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ loggedOut: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/staff/auth/login': {
        params: null,
        request: z.strictObject({
            email: z
                .string()
                .max(254)
                .regex(
                    new RegExp(
                        "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
                        'u',
                    ),
                )
                .pipe(z.email()),
            password: z.string().min(1).max(1024),
            context: z.union([z.literal('admin'), z.literal('moderator')]),
        }),
        success: z.strictObject({
            data: z.strictObject({
                status: z.literal('mfa_required'),
                challenge: z.string(),
                expiresAt: z
                    .string()
                    .regex(
                        new RegExp(
                            '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                            'u',
                        ),
                    )
                    .pipe(z.iso.datetime()),
                enrollment: z.strictObject({ secret: z.string(), uri: z.string() }).nullable(),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/staff/auth/mfa/verify': {
        params: null,
        request: z.strictObject({
            challenge: z.string().regex(new RegExp('^[A-Za-z0-9_-]{43}$', 'u')),
            code: z.string().min(6).max(64),
            method: z.union([z.literal('totp'), z.literal('recovery')]),
        }),
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
                recoveryCodes: z.array(z.string()),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/staff/auth/me': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                user: z.strictObject({
                    id: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                    displayName: z.string(),
                    context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                    expiresAt: z
                        .string()
                        .regex(
                            new RegExp(
                                '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                'u',
                            ),
                        )
                        .pipe(z.iso.datetime()),
                    sessionId: z
                        .string()
                        .regex(
                            new RegExp(
                                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                'u',
                            ),
                        )
                        .pipe(z.uuid()),
                }),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'GET /api/v1/staff/auth/sessions': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({
                sessions: z.array(
                    z.strictObject({
                        id: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                                    'u',
                                ),
                            )
                            .pipe(z.uuid()),
                        context: z.union([z.literal('user'), z.literal('admin'), z.literal('moderator')]),
                        authenticatedAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        expiresAt: z
                            .string()
                            .regex(
                                new RegExp(
                                    '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$',
                                    'u',
                                ),
                            )
                            .pipe(z.iso.datetime()),
                        current: z.boolean(),
                    }),
                ),
            }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/staff/auth/sessions/revoke-others': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ revokedCount: z.number().int().min(0).max(9007199254740991) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/staff/auth/logout': {
        params: null,
        request: null,
        success: z.strictObject({
            data: z.strictObject({ loggedOut: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
    'POST /api/v1/admin/telemetry/browser': {
        params: null,
        request: z.strictObject({
            application: z.union([z.literal('front'), z.literal('admin')]),
            code: z.union([
                z.literal('root_error'),
                z.literal('route_error'),
                z.literal('unhandled_error'),
                z.literal('unhandled_rejection'),
            ]),
            appVersion: z
                .string()
                .max(64)
                .regex(new RegExp('^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$', 'u'))
                .nullable(),
        }),
        success: z.strictObject({
            data: z.strictObject({ accepted: z.literal(true) }),
            meta: z.strictObject({
                requestId: z
                    .string()
                    .regex(
                        new RegExp(
                            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                            'u',
                        ),
                    )
                    .pipe(z.uuid()),
            }),
        }),
    },
};
export const errorSchema = z.strictObject({
    error: z.strictObject({
        code: z.string(),
        message: z.string(),
        details: z.record(z.string(), z.unknown()).nullable(),
    }),
    meta: z.strictObject({
        requestId: z
            .string()
            .regex(
                new RegExp(
                    '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
                    'u',
                ),
            )
            .pipe(z.uuid()),
    }),
});
export type Route = keyof typeof contracts;
export type Success<R extends Route> = z.infer<(typeof contracts)[R]['success']>;
export type Principal = Success<'GET /api/v1/auth/me'>['data']['user'];
