import assert from 'node:assert/strict';
import test from 'node:test';
import { checkProductionReadiness, manifestSchemas } from './check-production-readiness.mjs';

test('release report stays blocked only by unresolved manifests while deployment evidence is ready', async () => {
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
    assert.deepEqual(report.manifests.deployment.blockers, []);
    for (const [name, manifest] of Object.entries(report.manifests))
        if (name !== 'deployment') assert.ok(manifest.blockers.length > 0);
});

test('deployment manifest requires schema v31, verified runtime and pending custom DNS state', () => {
    const valid = {
        version: 2,
        status: 'ready',
        strategy: 'immutable_digest_rolling',
        blockers: [],
        deploymentPlatform: 'docker_compose_single_host',
        artifactRegistry: 'ghcr',
        ingressProvider: 'host_nginx',
        productionOrigins: {
            public: 'https://abstract-usable-gazebo.ruweb.place',
            admin: 'https://admin.abstract-usable-gazebo.ruweb.place',
        },
        pendingCustomOrigins: {
            status: 'pending_dns',
            public: 'https://meal.royalexander.online',
            admin: 'https://admin.meal.royalexander.online',
        },
        frontendReadinessPath: '/healthz',
        dependencyReadinessPaths: ['/health/live', '/health/ready'],
        trafficSwitchProvider: 'docker_compose_and_host_nginx',
        rollback: 'previous_verified_digest',
        databaseCompatibilityGate: 'expand_contract_review_required',
        targetSchemaVersion: 31,
        preTrafficGates: [
            'immutable_artifact',
            'database_v31_verified',
            'security_headers_verified',
            'browser_registry_verified',
            'workers_disabled_or_verified',
            'backup_restore_verified',
        ],
    };
    assert.equal(manifestSchemas.deployment.safeParse(valid).success, true);
    assert.equal(manifestSchemas.deployment.safeParse({ ...valid, targetSchemaVersion: 30 }).success, false);
    assert.equal(manifestSchemas.deployment.safeParse({ ...valid, status: 'blocked' }).success, false);
    assert.equal(
        manifestSchemas.deployment.safeParse({
            ...valid,
            pendingCustomOrigins: { ...valid.pendingCustomOrigins, status: 'ready' },
        }).success,
        false,
    );
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
