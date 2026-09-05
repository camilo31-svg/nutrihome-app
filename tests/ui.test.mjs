import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const demoData = await readFile(new URL('../demo-data.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), [], 'No hay IDs HTML duplicados');

for (const view of ['week', 'recipes', 'pantry', 'shopping', 'more']) {
  assert.match(html, new RegExp(`data-view="${view}"`));
  assert.match(html, new RegExp(`data-nav="${view}"`));
}
assert.match(html, /id="onboarding-form"/);
assert.match(html, /id="recipe-form"/);
assert.match(html, /id="pantry-form"/);
assert.match(html, /id="body-metrics-form"/);
assert.match(html, /id="body-goal-form"/);
assert.match(html, /id="weight-log-form"/);
assert.match(html, /id="weight-chart"/);
assert.match(html, /name="age"/);
assert.match(html, /name="muscleKg"/);
assert.match(html, /aria-live="polite"/);
assert.match(html, /class="skip-link"/);
assert.doesNotMatch(`${html}\n${app}\n${demoData}`, />TM<|Tu nombre|profile-name|profile-card-name/i);
assert.match(app, /getHours\(\) < 14 \? 'Buenos días' : 'Buenas tardes'/);
assert.equal(manifest.name.startsWith('NutriHome'), true);
assert.equal(manifest.icons.some(icon => icon.sizes === '192x192'), true);
assert.equal(manifest.icons.some(icon => icon.sizes === '512x512'), true);
for (const asset of ['nutrihome-core.js', 'demo-data.js', 'storage.js', 'app.js']) assert.equal(worker.includes(asset), true);
const shellMatch = worker.match(/const APP_SHELL = \[([\s\S]*?)\];/);
assert.ok(shellMatch, 'El service worker declara el app shell');
for (const match of shellMatch[1].matchAll(/'\.\/([^']+)'/g)) await access(new URL(`../${match[1]}`, import.meta.url));
for (const dialogId of ['onboarding-dialog', 'pantry-dialog', 'recipe-form-dialog', 'generator-dialog', 'simple-dialog']) assert.match(html, new RegExp(`data-close-dialog="${dialogId}"`));

console.log('NutriHome UI/PWA smoke tests passed');
