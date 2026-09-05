import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const client = path.join(dist, 'client');
const server = path.join(dist, 'server');

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });

for (const filename of ['index.html', 'styles.css', 'nutrihome-core.js', 'demo-data.js', 'recipe-library.js', 'storage.js', 'app.js', 'sw.js', 'manifest.webmanifest', 'og.png']) {
  await cp(path.join(root, filename), path.join(client, filename));
}
await cp(path.join(root, 'icons'), path.join(client, 'icons'), { recursive: true });
await cp(path.join(root, 'worker', 'index.js'), path.join(server, 'index.js'));

const hostingPath = path.join(root, '.openai', 'hosting.json');
try {
  await stat(hostingPath);
  await mkdir(path.join(dist, '.openai'), { recursive: true });
  await cp(hostingPath, path.join(dist, '.openai', 'hosting.json'));
} catch {
  // The first local build can run before a Sites project is created.
}

console.log('NutriHome build ready in dist/');
