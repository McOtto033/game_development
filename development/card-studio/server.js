'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BODY_BYTES = 25 * 1024 * 1024;
const STATIC_FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/app.js', 'app.js'],
  ['/model.js', 'model.js'],
  ['/targeting.js', 'targeting.js'],
  ['/storage.js', 'storage.js'],
  ['/styles.css', 'styles.css'],
  ['/favicon.svg', 'favicon.svg'],
]);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function emptyLibrary() {
  return { schemaVersion: 1, revision: 0, cards: [], definitions: [] };
}

class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class StorageError extends Error {}

function validateValue(value, location = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ClientError(400, `${location} に数値として保存できない値があります。`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateValue(item, `${location}[${index}]`));
    return;
  }
  if (typeof value !== 'object') throw new ClientError(400, `${location} の値が不正です。`);
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      throw new ClientError(400, `${location} に保存できないキーがあります。`);
    }
    validateValue(value[key], `${location}.${key}`);
  }
}

function validateEntries(entries, name) {
  if (!Array.isArray(entries) || entries.length > 1000) {
    throw new ClientError(400, `${name} は最大1000件の配列にしてください。`);
  }
  const ids = new Set();
  entries.forEach((entry, index) => {
    if (entry === null || Array.isArray(entry) || typeof entry !== 'object' || typeof entry.id !== 'string') {
      throw new ClientError(400, `${name}[${index}] には文字列の id が必要です。`);
    }
    if (ids.has(entry.id)) throw new ClientError(400, `${name} の id が重複しています。`);
    ids.add(entry.id);
  });
}

function validateLibrary(library) {
  validateValue(library);
  if (library === null || Array.isArray(library) || typeof library !== 'object') {
    throw new ClientError(400, 'ライブラリ全体はオブジェクトにしてください。');
  }
  if (library.schemaVersion !== 1 || !Number.isInteger(library.schemaVersion)) {
    throw new ClientError(400, 'schemaVersion は 1 にしてください。');
  }
  if (!Number.isInteger(library.revision) || library.revision < 0) {
    throw new ClientError(400, 'revision は0以上の整数にしてください。');
  }
  validateEntries(library.cards, 'cards');
  validateEntries(library.definitions, 'definitions');
  try {require('./model').validateIdeas(library.abilityIdeas);}catch(error){throw new ClientError(400,error.message);}
}

function checkHost(req) {
  const host = req.headers.host;
  if (!host || host.includes('/') || host.includes('\\')) throw new ClientError(400, 'Host ヘッダーが不正です。');
  const match = /^(127\.0\.0\.1|localhost):(\d+)$/.exec(host);
  if (!match || Number(match[2]) !== req.socket.localPort) {
    throw new ClientError(400, 'このサーバーはローカルの指定ポートだけを受け付けます。');
  }
  return host;
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(text);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on('data', chunk => {
      length += chunk.length;
      if (length > MAX_BODY_BYTES) {
        reject(new ClientError(413, '本文は25MiB以下にしてください。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function createStore(dataDir) {
  const libraryPath = path.join(dataDir, 'library.json');
  const backupDir = path.join(dataDir, 'backups');

  async function load() {
    let text;
    try {
      text = await fs.readFile(libraryPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return emptyLibrary();
      throw new StorageError('ライブラリを読めません。サーバーを停止し、READMEの手順に沿って data/backups から復旧してください。');
    }
    try {
      const library = JSON.parse(text);
      validateLibrary(library);
      return library;
    } catch {
      throw new StorageError('保存済みライブラリが壊れています。サーバーを停止し、READMEの手順に沿って data/backups から復旧してください。');
    }
  }

  async function save(next) {
    await fs.mkdir(dataDir, { recursive: true });
    try {
      await fs.access(libraryPath);
      await fs.mkdir(backupDir, { recursive: true });
      const backupName = `library-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`;
      await fs.copyFile(libraryPath, path.join(backupDir, backupName));
    } catch (error) {
      if (error.code !== 'ENOENT') throw new StorageError('既存ライブラリのバックアップを作れません。保存は中止しました。');
    }
    const temporaryPath = path.join(dataDir, `.library-${crypto.randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
      await fs.rename(temporaryPath, libraryPath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => {});
      throw new StorageError('ライブラリを安全に保存できませんでした。既存データは変更していません。');
    }
  }
  return { load, save };
}

function createServer({ dataDir = path.join(__dirname, 'data'), port = Number(process.env.CARD_STUDIO_PORT || 4317) } = {}) {
  const store = createStore(dataDir);
  let writes = Promise.resolve();

  const server = http.createServer(async (req, res) => {
    try {
      const host = checkHost(req);
      const url = new URL(req.url, `http://${host}`);
      if (url.pathname === '/api/library') {
        if (req.method === 'GET') return sendJson(res, 200, await store.load());
        if (req.method !== 'POST') return sendError(res, 405, 'このAPIではGETまたはPOSTを使ってください。');
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
          return sendError(res, 415, 'Content-Type は application/json にしてください。');
        }
        if (req.headers.origin && req.headers.origin !== `http://${host}`) {
          return sendError(res, 403, '別オリジンからの保存は許可されていません。');
        }
        const body = await readBody(req);
        let proposed;
        try { proposed = JSON.parse(body); } catch { return sendError(res, 400, 'JSONの形式が不正です。'); }
        validateLibrary(proposed);
        const write = writes.then(async () => {
          const current = await store.load();
          if (proposed.revision !== current.revision) throw new ClientError(409, '他の変更が保存されています。再読込してから保存してください。');
          const next = { ...proposed, revision: current.revision + 1 };
          await store.save(next);
          return next;
        });
        writes = write.catch(() => {});
        return sendJson(res, 200, await write);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, 405, 'GETのみ利用できます。');
      const filename = STATIC_FILES.get(url.pathname);
      if (!filename) return sendError(res, 404, 'ファイルが見つかりません。');
      const filePath = path.join(__dirname, filename);
      let content;
      try { content = await fs.readFile(filePath); } catch { return sendError(res, 404, 'ファイルが見つかりません。'); }
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filename)], 'Content-Length': content.length, 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') return res.end();
      res.end(content);
    } catch (error) {
      if (res.headersSent) return res.end();
      if (error instanceof ClientError) return sendError(res, error.status, error.message);
      if (error instanceof StorageError) return sendError(res, 503, error.message);
      return sendError(res, 500, 'サーバー内部でエラーが発生しました。');
    }
  });
  server.cardStudioPort = port;
  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(server.cardStudioPort, '127.0.0.1', () => {
    console.log(`カードスタジオを起動しました: http://127.0.0.1:${server.address().port}/`);
  });
}

module.exports = { createServer, emptyLibrary };
