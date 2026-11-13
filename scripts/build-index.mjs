#!/usr/bin/env node
// 掃 games/*/index.html，讀 <head> 的上架資訊，產生根目錄的 games.json。
// 缺欄位時：名稱 → 資料夾名；上架日期 → git 首次加入日期（再沒有就用今天）。
// 縮圖：games/<slug>/cover.png（手動放的）優先，其次 cover.auto.png（make-covers.mjs 截的），都沒有就 null（大廳顯示色塊）。
//
// 用法：node scripts/build-index.mjs

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMeta } from './lib/meta.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = join(ROOT, 'games');

function gitFirstAdded(relPath) {
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--follow', '--format=%as', '--', relPath],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    const lines = out.split('\n').filter(Boolean);
    return lines.at(-1) ?? null; // log 由新到舊，最後一行是最早加入
  } catch {
    return null;
  }
}

const today = new Date().toISOString().slice(0, 10);
const warnings = [];
const games = [];

for (const slug of existsSync(GAMES) ? readdirSync(GAMES).sort() : []) {
  const dir = join(GAMES, slug);
  const file = join(dir, 'index.html');
  if (!statSync(dir).isDirectory() || !existsSync(file)) continue;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    warnings.push(`略過 games/${slug}：資料夾名只能用小寫英數與 -`);
    continue;
  }

  const meta = readMeta(readFileSync(file, 'utf8'));
  const rel = `games/${slug}/index.html`;
  const missing = Object.entries(meta).filter(([, v]) => v == null).map(([k]) => k);
  if (missing.length) warnings.push(`${rel} 缺 ${missing.join(', ')}（已用預設值補）`);

  const cover = ['cover.png', 'cover.auto.png'].find((f) => existsSync(join(dir, f)));
  games.push({
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? '',
    tags: meta.tags ?? [],
    added: meta.added ?? gitFirstAdded(rel) ?? today,
    url: `games/${slug}/`,
    cover: cover ? `games/${slug}/${cover}` : null,
  });
}

// 最新在前；同一天依名稱
games.sort((a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title, 'zh-Hant'));

const out = { generatedAt: new Date().toISOString(), count: games.length, games };
writeFileSync(join(ROOT, 'games.json'), JSON.stringify(out, null, 2) + '\n');

for (const w of warnings) console.warn(`⚠️  ${w}`);
console.log(`✅ games.json：${games.length} 款遊戲`);
for (const g of games) console.log(`   - ${g.added}  ${g.slug}  ${g.title}${g.cover ? '' : '（無縮圖）'}`);
