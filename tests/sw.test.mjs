import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const handlers = new Map();
const images = {self: {}};
vm.runInNewContext(await readFile(new URL('../recipe-image-list.js', import.meta.url), 'utf8'), images);
const saved = new Map();
const deleted = [];
let networkCalls = 0;
const context = {
  URL,
  importScripts() {},
  self: {
    RECIPE_IMAGE_URLS: images.self.RECIPE_IMAGE_URLS,
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: async () => {},
    clients: {claim: async () => {}},
  },
  caches: {
    open: async () => ({addAll: async urls => urls.forEach(url => saved.set(url, {url}))}),
    keys: async () => ['nutrihome-v8', 'nutrihome-v9', 'unrelated-app'],
    delete: async key => {deleted.push(key);},
    match: async request => saved.get(typeof request === 'string' ? request : request.path),
  },
  fetch: async () => {networkCalls++; throw new Error('Offline');},
};
vm.runInNewContext(await readFile(new URL('../sw.js', import.meta.url), 'utf8'), context);
let pending;
handlers.get('install')({waitUntil: promise => {pending = promise;}});
await pending;
assert.ok(images.self.RECIPE_IMAGE_URLS.every(url => saved.has(url)), 'Todas las fotos se precargan');
handlers.get('activate')({waitUntil: promise => {pending = promise;}});
await pending;
assert.deepEqual(deleted, ['nutrihome-v8'], 'Solo se elimina la caché antigua de NutriHome');
for (const path of images.self.RECIPE_IMAGE_URLS) {
  handlers.get('fetch')({request: {method: 'GET', url: `https://nutrihome.test/${path.slice(2)}`, path}, respondWith: promise => {pending = promise;}});
  assert.equal((await pending).url, path, 'La imagen sigue disponible sin conexión');
}
assert.equal(networkCalls, 0, 'Las imágenes guardadas no vuelven a descargarse');
handlers.get('fetch')({request: {method: 'GET', mode: 'navigate', url: 'https://nutrihome.test/'}, respondWith: promise => {pending = promise;}});
assert.equal((await pending).url, './index.html', 'La app abre sin conexión');
let intercepted = false;
handlers.get('fetch')({request: {method: 'GET', url: 'https://nutrihome.test/api/state'}, respondWith: () => {intercepted = true;}});
assert.equal(intercepted, false, 'La sincronización personal nunca se sirve desde caché');
console.log('NutriHome offline image cache tests passed');
