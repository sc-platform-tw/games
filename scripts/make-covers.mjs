#!/usr/bin/env node
// 幫沒有 cover.png 的遊戲用 Playwright 開頁截圖，存成 games/<slug>/cover.auto.png。
// CI 每次部署都會跑；本機要跑需先安裝：
//   npm install && npx playwright install chromium
// 用法：node scripts/make-covers.mjs [--force]   （--force：連已有 cover.auto.png 的也重截）

import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, BASE } from './serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.warn('⚠️  沒有安裝 playwright，略過自動縮圖（大廳會顯示色塊）。安裝：npm install && npx playwright install chromium');
  process.exit(0);
}

const todo = readdirSync(join(ROOT, 'games')).filter((slug) => {
  const dir = join(ROOT, 'games', slug);
  return (
    existsSync(join(dir, 'index.html')) &&
    !existsSync(join(dir, 'cover.png')) &&
    (force || !existsSync(join(dir, 'cover.auto.png')))
  );
});

if (!todo.length) {
  console.log('✅ 每款遊戲都有縮圖了');
  process.exit(0);
}

const port = 8790 + Math.floor(Math.random() * 100);
const server = await startServer(port);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });

let failed = 0;
for (const slug of todo) {
  try {
    await page.goto(`http://localhost:${port}${BASE}games/${slug}/`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1200); // 給 CDN 載入的 React / 動畫一點時間
    await page.screenshot({ path: join(ROOT, 'games', slug, 'cover.auto.png') });
    console.log(`📸 ${slug}`);
  } catch (e) {
    failed++;
    console.warn(`⚠️  ${slug} 截圖失敗：${e.message.split('\n')[0]}`);
  }
}

await browser.close();
server.close();
console.log(`✅ 截圖完成 ${todo.length - failed}/${todo.length}`);
