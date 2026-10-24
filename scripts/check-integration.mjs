import assert from 'node:assert/strict';

// All three services must already be running in real mode. No provider calls or writes.
const origins = {
    backend: process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:3001',
    client: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
    admin: process.env.ADMIN_ORIGIN ?? 'http://localhost:3002',
};
const readiness = await fetch(`${origins.backend}/health/ready`, { signal: AbortSignal.timeout(30_000) });
assert.equal(readiness.status, 200, 'backend: database readiness');
console.log('PASS backend: database readiness');
for (const [name, origin] of Object.entries(origins)) {
    const authPath = name === 'admin' ? '/api/v1/admin/auth' : '/api/v1/auth';
    const response = await fetch(`${origin}${authPath}/csrf`, { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200, `${name}: CSRF endpoint`);
    const body = await response.json();
    assert.equal(typeof body.data?.token, 'string', `${name}: real CSRF response`);
    assert.ok(body.data.token.length > 0, `${name}: CSRF token must not be empty`);
    assert.ok(response.headers.get('set-cookie'), `${name}: session/CSRF cookie`);
    console.log(`PASS ${name}: real API routing and CSRF cookie`);
    const anonymous = await fetch(`${origin}${authPath}/me`, { signal: AbortSignal.timeout(30_000) });
    assert.equal(anonymous.status, 401, `${name}: anonymous requests must require login`);
    console.log(`PASS ${name}: anonymous session rejected`);
}
for (const name of ['client', 'admin']) {
    const response = await fetch(`${origins[name]}/auth`, { signal: AbortSignal.timeout(60_000) });
    assert.equal(response.status, 200, `${name}: auth page`);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/, `${name}: HTML`);
    console.log(`PASS ${name}: auth HTML`);
}
