import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.js';
import { defaultDataDir } from '../server/config.js';

test('projects and completed evidence metadata survive restart; unfinished jobs become interrupted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hub-store-'));
  let store = new Store(dir);
  try {
    const p = store.createProject('A project', 'https://example.com/', 'production');
    const done = store.createScan(p.id);
    store.running(done.id);
    store.finish(done.id, { title: 'Example', url: p.url, statusCode: 200, viewport: { width: 1440, height: 900 }, screenshotPath: `evidence/${done.id}.png`, checks: [], durationMs: 200 });
    const queued = store.createScan(p.id);
    const running = store.createScan(p.id); store.running(running.id);
    store.close(); store = new Store(dir);
    assert.equal(store.projects().length, 1);
    assert.equal(store.scan(done.id)?.result?.title, 'Example');
    assert.equal(store.scan(done.id)?.status, 'completed');
    assert.equal(store.scan(queued.id)?.status, 'interrupted');
    assert.equal(store.scan(running.id)?.status, 'interrupted');
    assert.ok(store.scan(running.id)?.finishedAt);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('prepared statements preserve quoted names without SQL interpretation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hub-store-'));
  const store = new Store(dir);
  try {
    store.createProject("Robert'); DROP TABLE projects;--", 'https://example.com', 'staging');
    assert.equal(store.projects().length, 1);
    assert.equal(store.project('missing'), undefined);
    assert.throws(() => new Store(dir), /already in use/);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('data directories are platform-appropriate and outside repository by default', () => {
  assert.equal(defaultDataDir('darwin', {}, '/users/test'), '/users/test/Library/Application Support/website-audit-hub');
  assert.equal(defaultDataDir('linux', { XDG_DATA_HOME: '/data' }, '/users/test'), '/data/website-audit-hub');
  assert.equal(defaultDataDir('linux', {}, '/users/test'), '/users/test/.local/share/website-audit-hub');
});
