import assert from 'node:assert/strict';
import test from 'node:test';
import { checkProductionReadiness, manifestSchemas } from './check-production-readiness.mjs';

test('release manifests remain explicitly blocked until deployment evidence and external decisions exist', async () => {
    const report = await checkProductionReadiness();
    assert.equal(report.status, 'blocked');
    assert.equal(report.scope, 'frontend_release_manifests');
    assert.deepEqual(Object.keys(report.manifests), [
        'cache',
        'deployment',
        'kpi',
        'browser',
        'securityHeaders',
        'scheduler',
        'paymentMethods',
    ]);
    assert.equal(report.manifests.deployment.version, 2);
    for (const manifest of Object.values(report.manifests)) assert.ok(manifest.blockers.length > 0);
});

test('deployment manifest requires schema v29 and the matching evidence gate', () => {
    const valid = {
        version: 2,
        status: 'blocked',
        strategy: 'immutable_digest_rolling',
        blockers: ['docker_runtime_evidence'],
        deploymentPlatform: 'docker_compose_single_host',
        artifactRegistry: 'ghcr',
        ingressProvider: 'host_nginx',
        productionOrigins: {
            public: 'https://abstract-usable-gazebo.ruweb.place',
            admin: 'https://admin.abstract-usable-gazebo.ruweb.place',
        },
        frontendReadinessPath: '/healthz',
        dependencyReadinessPaths: ['/health/live', '/health/ready'],
        trafficSwitchProvider: 'docker_compose_and_host_nginx',
        rollback: 'previous_verified_digest',
        databaseCompatibilityGate: 'expand_contract_review_required',
        targetSchemaVersion: 29,
        preTrafficGates: [
            'immutable_artifact',
            'database_v29_verified',
            'security_headers_verified',
            'browser_registry_verified',
            'workers_disabled_or_verified',
            'backup_restore_verified',
        ],
    };
    assert.equal(manifestSchemas.deployment.safeParse(valid).success, true);
    assert.equal(manifestSchemas.deployment.safeParse({ ...valid, targetSchemaVersion: 26 }).success, false);
});

test('readiness boundaries reject unsafe or falsely ready variants', () => {
    assert.equal(
        manifestSchemas.browser.safeParse({
            version: 1,
            status: 'ready',
            blockers: [],
            policy: 'evergreen',
            desktopEngines: [],
            mobileTargets: [],
            automatedProjects: [],
            evidence: [],
        }).success,
        false,
    );
    assert.equal(
        manifestSchemas.paymentMethods.safeParse({
            version: 1,
            status: 'blocked',
            blockers: ['provider'],
            provider: null,
            capabilities: ['list', 'revoke'],
            storage: 'full_card_number',
            sensitiveCardDataAllowed: true,
            listSemantics: {},
            revokeSemantics: {},
        }).success,
        false,
    );
});
