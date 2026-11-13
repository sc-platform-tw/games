// 讀寫遊戲 HTML <head> 裡的上架資訊（title / description / game:tags / game:added）
// 不依賴外部套件，用正則處理；只認 <head> 內的第一個 <title> 與各 meta。

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };

export function decode(s) {
  return s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, k) => ENTITIES[k]);
}

export function encode(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function headOf(html) {
  const m = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : html;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? '') : null;
}

/** 從 HTML 讀出上架資訊；沒有的欄位回傳 null */
export function readMeta(html) {
  const head = headOf(html);
  const t = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const meta = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = attr(tag, 'name');
    if (name) meta[name.toLowerCase()] = attr(tag, 'content');
  }
  const tags = (meta['game:tags'] ?? '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const added = meta['game:added'];
  return {
    title: t ? decode(t[1]).trim() || null : null,
    description: meta['description']?.trim() || null,
    tags: tags.length ? tags : null,
    added: added && /^\d{4}-\d{2}-\d{2}$/.test(added.trim()) ? added.trim() : null,
  };
}

/**
 * 把缺的欄位補進 <head>（已有的不覆蓋）。
 * fields: { title, description, tags: string[], added }
 */
export function ensureMeta(html, fields) {
  const cur = readMeta(html);
  const lines = [];
  if (!cur.title && fields.title) lines.push(`<title>${encode(fields.title)}</title>`);
  if (!cur.description && fields.description != null)
    lines.push(`<meta name="description" content="${encode(fields.description)}">`);
  if (!cur.tags && fields.tags?.length)
    lines.push(`<meta name="game:tags" content="${encode(fields.tags.join(','))}">`);
  if (!cur.added && fields.added) lines.push(`<meta name="game:added" content="${fields.added}">`);
  if (!lines.length) return html;

  const block = lines.map((l) => `  ${l}`).join('\n') + '\n';
  if (/<head[^>]*>/i.test(html)) {
    // 有 <title> 但是空的：先拿掉，避免兩個 title
    if (!cur.title && fields.title) html = html.replace(/<title[^>]*>\s*<\/title>\s*/i, '');
    return html.replace(/<head[^>]*>\n?/i, (m) => `${m.endsWith('\n') ? m : m + '\n'}${block}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>\n?/i, (m) => `${m.trimEnd()}\n<head>\n${block}</head>\n`);
  }
  return `<!doctype html>\n<html lang="zh-Hant">\n<head>\n  <meta charset="utf-8">\n${block}</head>\n<body>\n${html}\n</body>\n</html>\n`;
}
