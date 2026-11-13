#!/usr/bin/env node
// 本機靜態伺服器（零依賴），模擬 GitHub Pages 的 /games/ 子路徑。
// 用法：node scripts/serve.mjs [port]   → http://localhost:8080/games/

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASE = '/games/';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// 跟 Pages 一樣不提供 inbox/、scripts/ 等非網站內容
const PUBLIC = /^(index\.html|play\.html|leaderboard\.html|games\.json|assets\/|shared\/|games\/)/;

export function startServer(port = 8080) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' || path === BASE.slice(0, -1)) {
      res.writeHead(302, { Location: BASE }).end();
      return;
    }
    if (!path.startsWith(BASE)) return res.writeHead(404).end('Not found');
    let rel = normalize(path.slice(BASE.length));
    if (rel === '.' || rel === '') rel = 'index.html';
    if (rel.endsWith(sep) || rel.endsWith('/')) rel += 'index.html';
    if (rel.startsWith('..') || !PUBLIC.test(rel.split(sep).join('/'))) {
      return res.writeHead(404).end('Not found');
    }
    let file = join(ROOT, rel);
    try {
      if ((await stat(file)).isDirectory()) {
        res.writeHead(302, { Location: path + '/' }).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 8080);
  await startServer(port);
  console.log(`🎮 大廳：http://localhost:${port}${BASE}`);
}
