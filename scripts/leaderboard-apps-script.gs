/**
 * SC 平台 · 線上排行榜（Google 試算表 + Apps Script）
 *
 * 設定步驟（約 10 分鐘，只要做一次）：
 *   1. 開一個新的 Google 試算表，取名「SC 遊戲排行榜」。
 *   2. 選單「擴充功能 → Apps Script」，把這個檔案的內容整個貼上，存檔。
 *   3. 右上「部署 → 新增部署作業」→ 類型選「網頁應用程式」
 *        執行身分：我
 *        誰可以存取：所有人
 *      → 部署 → 授權 → 複製「網頁應用程式網址」（結尾是 /exec）。
 *   4. 把網址填進 shared/score.js 的 ENDPOINT，commit + push。
 *
 * 分數會一筆一筆寫進試算表的「scores」工作表，你可以直接打開看、刪掉作弊的紀錄。
 * 注意：這是公開網址，任何人都能送分數進來；小遊戲排行榜可以接受，
 * 看到怪分數就到試算表刪掉那一列。
 */

var SHEET = 'scores';
var HEAD = ['時間', '遊戲', '榜', '名字', '分數', '排序', '單位'];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function clean_(s, n) {
  // 去掉 < >，開頭是 = + - @ 時加 ' 避免被試算表當公式
  var v = String(s == null ? '' : s).replace(/[<>]/g, '').slice(0, n);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false }); }
  var game = String(d.game || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  var score = Number(d.score);
  if (!game || !isFinite(score) || Math.abs(score) > 1e9) return out_({ ok: false });
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    sheet_().appendRow([
      new Date(), game, clean_(d.board, 20), clean_(d.name || '玩家', 12), score,
      d.order === 'asc' ? 'asc' : 'desc', clean_(d.unit, 6)
    ]);
  } finally { lock.releaseLock(); }
  return out_({ ok: true });
}

function doGet(e) {
  var p = e.parameter || {};
  var game = String(p.game || '');
  var board = String(p.board || '');
  var limit = Math.min(Number(p.limit) || 10, 50);
  var rows = sheet_().getDataRange().getValues().slice(1).filter(function (r) { return r[1] === game; });
  var boards = [];
  rows.forEach(function (r) { if (boards.indexOf(String(r[2])) < 0) boards.push(String(r[2])); });
  var mine = rows.filter(function (r) { return String(r[2]) === board; });
  var last = mine[mine.length - 1] || rows[rows.length - 1];
  var order = p.order || (last ? last[5] : 'desc');
  mine.sort(function (a, b) { return order === 'asc' ? a[4] - b[4] : b[4] - a[4]; });
  return out_({
    order: order,
    unit: last ? last[6] : '',
    boards: boards,
    list: mine.slice(0, limit).map(function (r) {
      return { name: r[3], score: r[4], t: new Date(r[0]).getTime() };
    })
  });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
