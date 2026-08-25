import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

const server = http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  let target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!target.startsWith(root + path.sep)) target = path.join(root, 'index.html');
  try {
    if (!(await stat(target)).isFile()) throw new Error('Not a file');
  } catch {
    target = path.join(root, 'index.html');
  }
  response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  createReadStream(target).pipe(response);
});

server.listen(port, '127.0.0.1', () => console.log(`Marea available at http://127.0.0.1:${port}`));
