import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';

test('API session, CSRF, demo, queue deduplication and malformed requests', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'hub-api-'));
  const { app, store } = await createApp({ port: 4310, dataDir, runJobs: false });
  const host = '127.0.0.1:4310';
  try {
    assert.equal((await app.inject({ url: '/api/bootstrap', headers: { host } })).statusCode, 401);
    const home = await app.inject({ url: '/', headers: { host } });
    assert.equal(home.statusCode, 200);
    const cookie = String(home.headers['set-cookie']).split(';')[0];
    const headers = { host, cookie, 'x-hub-request': '1', origin: 'http://127.0.0.1:4310' };
    assert.equal((await app.inject({ url: '/api/bootstrap', headers: { ...headers, host: 'evil.test:4310' } })).statusCode, 403);
    assert.equal((await app.inject({ url: '/api/bootstrap', headers: { ...headers, origin: 'https://evil.test' } })).statusCode, 403);
    assert.equal((await app.inject({ url: '/api/bootstrap', headers: { ...headers, 'sec-fetch-site': 'cross-site' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/demo', headers: { host, cookie } })).statusCode, 403);
    const demo = await app.inject({ method: 'POST', url: '/api/demo', headers });
    assert.equal(demo.statusCode, 201);
    const body = demo.json();
    assert.equal(body.project.name, 'Northstar Studio · Demo');
    assert.equal(body.scan.status, 'queued');
    assert.equal((await app.inject({ method: 'POST', url: '/api/demo', headers })).statusCode, 409);
    const bootstrap = (await app.inject({ url: '/api/bootstrap', headers })).json();
    assert.equal(bootstrap.projects.length, 1);
    assert.equal(bootstrap.scans.length, 1);
    assert.equal(bootstrap.dependencies.find((d: { id: string }) => d.id === 'storage').status, 'ready');
    assert.equal((await app.inject({ method: 'POST', url: '/api/projects/missing/scans', headers })).statusCode, 404);
    assert.equal((await app.inject({ url: `/api/scans/${body.scan.id}/screenshot`, headers })).statusCode, 404);
    for (const payload of [
      { name: 'Private', url: 'http://127.0.0.1', environment: 'local', acknowledged: true },
      { name: '', url: 'https://example.com', environment: 'production', acknowledged: true },
      { name: 'Name', url: 'https://example.com', environment: 'production', acknowledged: false },
      { name: 'Name', url: 'file:///tmp/test', environment: 'production', acknowledged: true },
    ]) assert.equal((await app.inject({ method: 'POST', url: '/api/projects', headers, payload })).statusCode, 400);
    assert.equal(store.projects().length, 1);
    const created = await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { name: 'Public literal test', url: 'https://8.8.8.8', environment: 'staging', acknowledged: true } });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().project.url, 'https://8.8.8.8/');
    assert.equal((await app.inject({ url: '/api/bootstrap', headers: { host, cookie: `hub_session=${'é'.repeat(64)}` } })).statusCode, 401);
  } finally { await app.close(); rmSync(dataDir, { recursive: true, force: true }); }
});
