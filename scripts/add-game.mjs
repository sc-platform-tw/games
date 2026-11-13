#!/usr/bin/env node
// 把一個從 claude.ai chat 下載的遊戲上架到 games/<slug>/index.html。
//
// 用法：
//   node scripts/add-game.mjs <檔案> [slug] [--title 名稱] [--desc 說明] [--tags 標籤1,標籤2] [--force]
//
// - <檔案> 可以是 .html（單一自包含 HTML）或 .jsx / .tsx（claude.ai 的 React artifact）。
//   .jsx 會包成單一 HTML：Tailwind CDN + React 18（esm.sh）+ Babel standalone 在瀏覽器編譯。
// - slug 沒給就用檔名轉小寫英數與 -。
// - 只補缺的 meta（title / description / game:tags / game:added），已經有的不動。
// - 會掃描 window.claude、API key 樣式字串並警告；不會自動改遊戲邏輯。
// - 不會 commit，做完請本機試玩：node scripts/build-index.mjs && node scripts/serve.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureMeta, readMeta } from './lib/meta.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- 參數 ----
const args = process.argv.slice(2);
const opts = {};
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--force') opts.force = true;
  else if (a.startsWith('--')) opts[a.slice(2)] = args[++i];
  else pos.push(a);
}
const [src, slugArg] = pos;
if (!src || !existsSync(src)) {
  console.error('用法：node scripts/add-game.mjs <檔案.html|.jsx> [slug] [--title 名稱] [--desc 說明] [--tags a,b] [--force]');
  process.exit(1);
}

const ext = extname(src).toLowerCase();
const slug = (slugArg ?? basename(src, ext))
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
if (!slug) {
  console.error('❌ 檔名轉不出 slug（只能用英數），請手動指定：node scripts/add-game.mjs <檔案> my-game');
  process.exit(1);
}

const dir = join(ROOT, 'games', slug);
const dest = join(dir, 'index.html');
if (existsSync(dest) && !opts.force) {
  console.error(`❌ games/${slug}/ 已經存在。要覆蓋請加 --force，或換一個 slug。`);
  process.exit(1);
}

// ---- 讀檔 / 轉檔 ----
let source = readFileSync(src, 'utf8');
let html;
if (ext === '.html' || ext === '.htm') {
  html = source;
} else if (['.jsx', '.tsx', '.js'].includes(ext)) {
  html = wrapReact(source, opts.title ?? slug);
} else {
  console.error(`❌ 不支援的副檔名 ${ext}（只收 .html / .jsx / .tsx）`);
  process.exit(1);
}

// ---- 補 meta ----
const today = new Date().toISOString().slice(0, 10);
const before = readMeta(html);
html = ensureMeta(html, {
  title: opts.title ?? slug,
  description: opts.desc ?? '',
  tags: opts.tags ? opts.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : ['未分類'],
  added: today,
});
if (!/<meta\s+charset/i.test(html)) html = html.replace(/<head[^>]*>\n?/i, (m) => `${m}  <meta charset="utf-8">\n`);
if (!/name=["']viewport["']/i.test(html))
  html = html.replace(/<head[^>]*>\n?/i, (m) => `${m}  <meta name="viewport" content="width=device-width, initial-scale=1">\n`);

mkdirSync(dir, { recursive: true });
writeFileSync(dest, html);
const after = readMeta(html);

// ---- 相容性檢查 ----
const warns = [];
if (/window\.claude\b/.test(source)) warns.push('用到 window.claude（claude.ai 專用 API，Pages 上不能用）→ 存檔改 localStorage、AI 呼叫要拿掉');
if (/\bfetch\s*\(\s*["'`]https:\/\/api\.anthropic\.com/.test(source)) warns.push('直接呼叫 api.anthropic.com → 公開網站不能放 API key，請拿掉這段功能');
const keyLike = source.match(/\b(sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|xox[bp]-[A-Za-z0-9-]{10,})/g);
if (keyLike) warns.push(`疑似 API key / token 共 ${keyLike.length} 處（${keyLike.map((k) => k.slice(0, 6) + '…').join(', ')}）→ 必須刪掉再上架`);
if (/\b(sessionStorage|indexedDB)\b/.test(source)) warns.push('用到 sessionStorage / indexedDB，可以用，但要確認關掉分頁後的行為是否符合預期');
if (/<script[^>]+src=["'](?!https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|esm\.sh|cdn\.tailwindcss\.com))/i.test(html))
  warns.push('有載入本機相對路徑或非常見 CDN 的 script，確認檔案都在 games/' + slug + '/ 底下');

console.log(`✅ 已上架到 games/${slug}/index.html${ext !== '.html' ? '（由 ' + ext + ' 包成 HTML）' : ''}`);
console.log(`   名稱：${after.title}${before.title ? '' : '（補）'}`);
console.log(`   說明：${after.description || '（空白，記得補 <meta name="description">）'}`);
console.log(`   標籤：${after.tags?.join(', ')}${before.tags ? '' : '（補）'}`);
console.log(`   日期：${after.added}${before.added ? '' : '（補）'}`);
for (const w of warns) console.warn(`⚠️  ${w}`);
console.log('\n下一步：node scripts/build-index.mjs && node scripts/serve.mjs  → 本機試玩後再 commit');

// ---- React artifact → 單一 HTML ----
function wrapReact(code, title) {
  // 1) 第三方 import 改指 esm.sh（React 固定 18.3.1，其他套件共用同一份 React）
  const REACT = 'https://esm.sh/react@18.3.1';
  const rewritten = code
    .replace(/from\s+(['"])react\1/g, `from '${REACT}'`)
    .replace(/from\s+(['"])react-dom(\/client)?\1/g, (_, q, sub) => `from 'https://esm.sh/react-dom@18.3.1${sub ?? ''}'`)
    .replace(/from\s+(['"])(?![./]|https?:)([^'"]+)\1/g, (_, q, pkg) => `from 'https://esm.sh/${pkg}?deps=react@18.3.1,react-dom@18.3.1'`)
    // 2) export default → 存到 window.__App，最後再掛上去
    .replace(/export\s+default\s+/, 'window.__App = ');

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title.replace(/</g, '&lt;')}</title>
  <!-- 由 scripts/add-game.mjs 從 React artifact 轉出：Tailwind + React 18（esm.sh）+ Babel standalone -->
  <script src="https://cdn.tailwindcss.com/3.4.16"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.26.4/babel.min.js"></script>
  <style>html,body,#root{margin:0;min-height:100%}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module" data-presets="react,typescript" data-filename="app.tsx">
${rewritten}

import { createRoot as __createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import __React from '${REACT}';
__createRoot(document.getElementById('root')).render(__React.createElement(window.__App));
  </script>
</body>
</html>
`;
}
