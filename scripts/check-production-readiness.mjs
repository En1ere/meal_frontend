import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const blocked = z.literal('blocked');
const blockers = z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1);

const cacheSchema = z.strictObject({
    version: z.literal(1),
    status: blocked,
    blockers,
    classes: z.strictObject({
        security_sensitive: z.literal('no-store'),
        private: z.literal('private, no-store'),
        public_dynamic: z.literal('no-store'),
        static_fingerprinted: z.literal('public, max-age=31536000, immutable'),
        service_worker: z.literal('no-cache, no-store, must-revalidate'),
    }),
    publicRouteAllowlist: z.array(z.string()).length(0),
    purgeProvider: z.null(),
});

const deploymentSchema = z.strictObject({
    version: z.literal(2),
    status: z.literal('ready'),
    strategy: z.literal('immutable_digest_rolling'),
    blockers: z.array(z.never()).length(0),
    deploymentPlatform: z.literal('docker_compose_single_host'),
    artifactRegistry: z.literal('ghcr'),
    ingressProvider: z.literal('host_nginx'),
    productionOrigins: z.strictObject({
        public: z.literal('https://abstract-usable-gazebo.ruweb.place'),
        admin: z.literal('https://admin.abstract-usable-gazebo.ruweb.place'),
    }),
    pendingCustomOrigins: z.strictObject({
        status: z.literal('pending_dns'),
        public: z.literal('https://meal.royalexander.online'),
        admin: z.literal('https://admin.meal.royalexander.online'),
    }),
    frontendReadinessPath: z.literal('/healthz'),
    dependencyReadinessPaths: z.tuple([z.literal('/health/live'), z.literal('/health/ready')]),
    trafficSwitchProvider: z.literal('docker_compose_and_host_nginx'),
    rollback: z.literal('previous_verified_digest'),
    databaseCompatibilityGate: z.literal('expand_contract_review_required'),
    targetSchemaVersion: z.literal(31),
    preTrafficGates: z.tuple([
        z.literal('immutable_artifact'),
        z.literal('database_v31_verified'),
        z.literal('security_headers_verified'),
        z.literal('browser_registry_verified'),
        z.literal('workers_disabled_or_verified'),
        z.literal('backup_restore_verified'),
    ]),
});

const kpiSchema = z.strictObject({
    version: z.literal(1),
    status: blocked,
    blockers,
    allowedGroups: z.tuple([
        z.literal('user_cycle'),
        z.literal('funnel'),
        z.literal('action_error'),
        z.literal('performance'),
    ]),
    definitions: z.array(z.never()).length(0),
});

const browserSchema = z.strictObject({
    version: z.literal(1),
    status: blocked,
    blockers,
    policy: z.literal('current_and_previous_stable_at_release'),
    desktopEngines: z.tuple([z.literal('chromium'), z.literal('firefox'), z.literal('webkit')]),
    mobileTargets: z.tuple([z.literal('ios_safari'), z.literal('android_chrome')]),
    automatedProjects: z.tuple([
        z.literal('desktop-chromium'),
        z.literal('desktop-firefox'),
        z.literal('desktop-webkit'),
        z.literal('mobile-chromium'),
    ]),
    evidence: z.array(z.never()).length(0),
});

const securityHeadersSchema = z.strictObject({
    version: z.literal(1),
    status: blocked,
    blockers,
    owner: z.literal('ingress_and_application'),
    required: z.strictObject({
        strictTransportSecurity: z.literal('max-age=31536000; includeSubDomains'),
        contentTypeOptions: z.literal('nosniff'),
        frameAncestors: z.literal("'none'"),
        referrerPolicy: z.literal('strict-origin-when-cross-origin'),
        permissionsPolicy: z.literal('camera=(), microphone=(), geolocation=()'),
    }),
    contentSecurityPolicyMode: z.literal('report_only_then_enforce'),
    productionProbeEvidence: z.null(),
});

const schedulerSchema = z.strictObject({
    version: z.literal(1),
    status: blocked,
    blockers,
    topologyVersion: z.literal(1),
    defaultEnabled: z.literal(false),
    tasks: z.tuple([
        z.literal('scheduled-news'),
        z.literal('incident-ignore-expiry'),
        z.literal('retention-inspection'),
        z.literal('scheduled-sanctions'),
        z.literal('diary-portions'),
        z.literal('email-changes'),
        z.literal('exports'),
        z.literal('account-retention'),
        z.literal('ai-reconciliation'),
        z.literal('cooking-lifecycle'),
    ]),
    provider: z.null(),
    schedules: z.array(z.never()).length(0),
});

const paymentMethodsSchema = z.strictObject({
    version: z.literal(1),
    status: blocked,
    blockers,
    provider: z.null(),
    capabilities: z.tuple([z.literal('list'), z.literal('revoke')]),
    storage: z.literal('opaque_provider_reference_only'),
    sensitiveCardDataAllowed: z.literal(false),
    listSemantics: z.strictObject({
        source: z.literal('provider_or_synchronized_projection'),
        displayFields: z.tuple([
            z.literal('id'),
            z.literal('brand'),
            z.literal('last4'),
            z.literal('expiryMonth'),
            z.literal('expiryYear'),
            z.literal('status'),
        ]),
        authoritativeForCharges: z.literal(false),
    }),
    revokeSemantics: z.strictObject({
        operation: z.literal('detach_or_disable_future_use'),
        idempotent: z.literal(true),
        preservePaymentHistory: z.literal(true),
        networkOutsideDatabaseTransaction: z.literal(true),
        unknownOutcomeRequiresReconciliation: z.literal(true),
    }),
});

export const manifestFiles = {
    cache: 'config/production-readiness/cache-policy.v1.json',
    deployment: 'config/production-readiness/deployment-strategy.v2.json',
    kpi: 'config/production-readiness/kpi-catalog.v1.json',
    browser: 'config/production-readiness/browser-support.v1.json',
    securityHeaders: 'config/production-readiness/security-headers.v1.json',
    scheduler: 'config/production-readiness/scheduler.v1.json',
    paymentMethods: 'config/production-readiness/payment-methods.v1.json',
};

export const manifestSchemas = {
    cache: cacheSchema,
    deployment: deploymentSchema,
    kpi: kpiSchema,
    browser: browserSchema,
    securityHeaders: securityHeadersSchema,
    scheduler: schedulerSchema,
    paymentMethods: paymentMethodsSchema,
};

export async function checkProductionReadiness(root = process.cwd()) {
    const manifests = {};
    for (const [name, relativePath] of Object.entries(manifestFiles)) {
        const raw = JSON.parse(await readFile(resolve(root, relativePath), 'utf8'));
        manifests[name] = manifestSchemas[name].parse(raw);
    }

    return {
        status: 'blocked',
        scope: 'frontend_release_manifests',
        externalEvidenceRequired: ['backend_schema_and_grants', 'workers', 'backup_restore', 'ingress_headers'],
        manifests: Object.fromEntries(
            Object.entries(manifests).map(([name, manifest]) => [
                name,
                { version: manifest.version, blockers: manifest.blockers },
            ]),
        ),
    };
}

async function main() {
    const report = await checkProductionReadiness();
    console.log(JSON.stringify(report, null, 2));
    if (process.argv.includes('--require-ready')) process.exitCode = report.status === 'blocked' ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
