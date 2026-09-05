import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const assets = { fetch: async () => new Response('<!doctype html><title>NutriHome</title>', { headers: { 'content-type': 'text/html' } }) };

const noDatabase = await worker.fetch(new Request('https://nutrihome.example/api/state'), { ASSETS: assets });
assert.equal(noDatabase.status, 503);
const noUser = await worker.fetch(new Request('https://nutrihome.example/api/state'), { ASSETS: assets, DB: {} });
assert.equal(noUser.status, 401);
const unsafeImport = await worker.fetch(new Request('https://nutrihome.example/api/import-recipe?url=http%3A%2F%2F127.0.0.1%2Fprivate'), { ASSETS: assets });
assert.equal(unsafeImport.status, 400);
let stored = null;
const DB = { prepare(sql) { const statement = { values: [], bind(...values) { this.values = values; return this; }, async run() { if (sql.startsWith('INSERT')) stored = this.values[1]; return { success: true }; }, async first() { return stored ? { state_json: stored } : null; } }; return statement; } };
const headers = { 'oai-authenticated-user-id': 'user-test', 'content-type': 'application/json' };
const put = await worker.fetch(new Request('https://nutrihome.example/api/state', { method: 'PUT', headers, body: JSON.stringify({ state: { version: 1, updatedAt: '2026-09-05T00:00:00.000Z' } }) }), { ASSETS: assets, DB });
assert.equal(put.status, 200);
const get = await worker.fetch(new Request('https://nutrihome.example/api/state', { headers }), { ASSETS: assets, DB });
assert.deepEqual((await get.json()).state, { version: 1, updatedAt: '2026-09-05T00:00:00.000Z' });
const asset = await worker.fetch(new Request('https://nutrihome.example/'), { ASSETS: assets });
assert.equal(asset.headers.get('x-content-type-options'), 'nosniff');
assert.match(asset.headers.get('content-security-policy'), /default-src 'self'/);

console.log('NutriHome Worker security tests passed');
