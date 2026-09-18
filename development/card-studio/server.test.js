'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer, emptyLibrary } = require('./server.js');

async function start() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'card-studio-'));
  const dataDir = path.join(root, 'data');
  const server = createServer({ dataDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    root, dataDir, server, port,
    async close() { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); },
  };
}

function request(port, method, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port, method, path: pathname, headers: {
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }),
      ...headers,
    } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

function library(revision, cards = [{ id: 'card-a', name: '保持される任意フィールド', nested: { power: 8 } }]) {
  return { schemaVersion: 1, revision, cards, definitions: [{ id: 'definition-a', tags: ['alpha'] }] };
}

test('初回GETは空ライブラリを返し、ファイルを作らない', async () => {
  const app = await start();
  try {
    const response = await request(app.port, 'GET', '/api/library');
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), emptyLibrary());
    await assert.rejects(fs.access(path.join(app.dataDir, 'library.json')));
  } finally { await app.close(); }
});

test('保存は永続化され、再起動後にも読める', async () => {
  const app = await start();
  try {
    const saved = await request(app.port, 'POST', '/api/library', library(0));
    assert.equal(saved.status, 200);
    assert.equal(JSON.parse(saved.body).revision, 1);
    await new Promise(resolve => app.server.close(resolve));
    const restarted = createServer({ dataDir: app.dataDir });
    await new Promise(resolve => restarted.listen(0, '127.0.0.1', resolve));
    const loaded = await request(restarted.address().port, 'GET', '/api/library');
    assert.deepEqual(JSON.parse(loaded.body), { ...library(0), revision: 1 });
    await new Promise(resolve => restarted.close(resolve));
  } finally { await app.close(); }
});

test('revision競合と並列保存は既存データを壊さない', async () => {
  const app = await start();
  try {
    assert.equal((await request(app.port, 'POST', '/api/library', library(0))).status, 200);
    const [first, second] = await Promise.all([
      request(app.port, 'POST', '/api/library', library(1, [{ id: 'first' }])),
      request(app.port, 'POST', '/api/library', library(1, [{ id: 'second' }])),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [200, 409]);
    const loaded = JSON.parse((await request(app.port, 'GET', '/api/library')).body);
    assert.equal(loaded.revision, 2);
    assert.ok(['first', 'second'].includes(loaded.cards[0].id));
  } finally { await app.close(); }
});

test('不正なインポートは拒否され、既存データを変えない', async () => {
  const app = await start();
  try {
    await request(app.port, 'POST', '/api/library', library(0));
    const invalid = { ...library(1, [{ id: 'duplicated' }, { id: 'duplicated' }]), definitions: [] };
    assert.equal((await request(app.port, 'POST', '/api/library', invalid)).status, 400);
    const dangerous = JSON.parse('{"schemaVersion":1,"revision":1,"cards":[],"definitions":[],"__proto__":{"polluted":true}}');
    assert.equal((await request(app.port, 'POST', '/api/library', dangerous)).status, 400);
    const loaded = JSON.parse((await request(app.port, 'GET', '/api/library')).body);
    assert.equal(loaded.revision, 1);
    assert.equal(loaded.cards[0].id, 'card-a');
  } finally { await app.close(); }
});

test('更新前の保存はバックアップされ、Originと静的禁止パスを拒否する', async () => {
  const app = await start();
  try {
    await request(app.port, 'POST', '/api/library', library(0));
    assert.equal((await request(app.port, 'POST', '/api/library', library(1, [{ id: 'new' }]))).status, 200);
    const backups = await fs.readdir(path.join(app.dataDir, 'backups'));
    assert.equal(backups.length, 1);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(app.dataDir, 'backups', backups[0]), 'utf8')), { ...library(0), revision: 1 });
    assert.equal((await request(app.port, 'POST', '/api/library', library(2), { Origin: 'http://evil.example' })).status, 403);
    const blocked = await request(app.port, 'GET', '/server.js');
    assert.equal(blocked.status, 404);
    assert.equal(blocked.headers['x-content-type-options'], 'nosniff');
  } finally { await app.close(); }
});

test('破損した保存済みファイルは503で閉じ、空データとして扱わない', async () => {
  const app = await start();
  try {
    await fs.mkdir(app.dataDir, { recursive: true });
    await fs.writeFile(path.join(app.dataDir, 'library.json'), '{ not-json', 'utf8');
    const response = await request(app.port, 'GET', '/api/library');
    assert.equal(response.status, 503);
    assert.match(JSON.parse(response.body).error, /復旧/);
  } finally { await app.close(); }
});
