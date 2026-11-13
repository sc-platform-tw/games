/*
 * SC 平台 · 共用分數 / 排行榜
 *
 * 遊戲裡這樣用（在 <head> 加 <script src="../../shared/score.js"></script>）：
 *   window.SCGames && SCGames.submit('my-game', score);                       // 分數越高越好
 *   window.SCGames && SCGames.submit('my-game', moves, { order: 'asc' });     // 越低越好（步數、秒數）
 *   window.SCGames && SCGames.submit('my-game', score, { board: '困難', unit: '分' }); // 分難度各一張榜
 *
 * 預設存在瀏覽器（localStorage），每台裝置各自一份。
 * 想要大家共用排行榜：照 scripts/leaderboard-apps-script.gs 的說明建 Google 試算表，
 * 把部署出來的網址填進下面的 ENDPOINT 就好，遊戲不用改。
 */
(function () {
  'use strict';

  // ↓↓↓ 線上排行榜網址（Google Apps Script Web App，結尾是 /exec）。留空 = 只存本機 ↓↓↓
  var ENDPOINT = '';
  // ↑↑↑

  var PREFIX = 'sc-games:';
  var KEEP = 50;

  function ls(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(PREFIX + k) || 'null');
      localStorage.setItem(PREFIX + k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  function boardKey(game, board) { return 'scores:' + game + (board ? ':' + board : ''); }
  function sortList(list, order) {
    return list.sort(function (a, b) {
      return order === 'asc' ? a.score - b.score || a.t - b.t : b.score - a.score || a.t - b.t;
    });
  }
  function getName() { return ls('player') || ''; }
  function clean(s) { return String(s || '').replace(/[<>]/g, '').trim().slice(0, 12); }

  function localTop(game, opts) {
    opts = opts || {};
    var list = ls(boardKey(game, opts.board)) || [];
    return sortList(list, opts.order).slice(0, opts.limit || 10);
  }

  function remote(entry) {
    if (!ENDPOINT) return;
    try {
      fetch(ENDPOINT, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(entry)
      }).catch(function () {});
    } catch (e) {}
  }

  // ---- 小小 UI：結算時右下角提示 + 第一次輸入名字 ----
  var css = '.scg-toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;background:#1d1d1f;color:#fff;' +
    'font:15px/1.4 system-ui,-apple-system,"PingFang TC","Noto Sans TC",sans-serif;border-radius:14px;padding:10px 14px;box-shadow:0 6px 24px #0005;' +
    'display:flex;gap:10px;align-items:center;max-width:94vw;flex-wrap:wrap;justify-content:center}' +
    '.scg-toast a,.scg-toast button{color:#ffd23f;background:none;border:0;font:inherit;font-weight:700;padding:4px 2px;cursor:pointer;text-decoration:none;margin:0;box-shadow:none}' +
    '.scg-modal{position:fixed;inset:0;z-index:99999;background:#0007;display:flex;align-items:center;justify-content:center;padding:20px;' +
    'font:16px/1.5 system-ui,-apple-system,"PingFang TC","Noto Sans TC",sans-serif}' +
    '.scg-box{background:#fff;color:#222;border-radius:18px;padding:22px 20px;width:min(320px,100%);text-align:center}' +
    '.scg-box h3{margin:0 0 6px;font-size:20px}.scg-box p{margin:0 0 12px;color:#666;font-size:14px}' +
    '.scg-box input{width:100%;box-sizing:border-box;font-size:18px;padding:10px 12px;border:2px solid #ddd;border-radius:12px;text-align:center;user-select:text;-webkit-user-select:text}' +
    '.scg-box button{margin:14px 4px 0;font-size:16px;font-weight:700;padding:10px 22px;border:0;border-radius:24px;background:#2f6fed;color:#fff;box-shadow:none}' +
    '.scg-box button.alt{background:#eee;color:#444}';
  var styled = false;
  function style() {
    if (styled) return; styled = true;
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }
  function stop(e) { e.stopPropagation(); }
  function guard(el) { ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown'].forEach(function (t) { el.addEventListener(t, stop); }); }

  function lbUrl(game) {
    // 遊戲在 games/<slug>/ 底下，排行榜在根目錄
    return '../../leaderboard.html?g=' + encodeURIComponent(game);
  }

  var toastEl, toastTimer;
  function toast(entry, rank) {
    style();
    if (toastEl) toastEl.remove();
    clearTimeout(toastTimer);
    toastEl = document.createElement('div');
    toastEl.className = 'scg-toast';
    guard(toastEl);
    var who = entry.name || '玩家';
    toastEl.innerHTML = '<span>🏆 ' + who + '：' + entry.score + (entry.unit ? ' ' + entry.unit : '') +
      (rank ? '・本機第 ' + rank + ' 名' : '') + '</span>' +
      '<a target="_top" href="' + lbUrl(entry.game) + '">看排行榜</a>' +
      '<button type="button">改名字</button>';
    toastEl.querySelector('button').onclick = function () { askName(entry); };
    document.body.appendChild(toastEl);
    toastTimer = setTimeout(function () { toastEl && toastEl.remove(); }, 6000);
  }

  function askName(entry) {
    style();
    var m = document.createElement('div');
    m.className = 'scg-modal';
    guard(m);
    m.innerHTML = '<div class="scg-box"><h3>你的名字？</h3><p>會顯示在排行榜上（最多 12 字，不要填全名）</p>' +
      '<input maxlength="12" placeholder="例如：小雞王"><div><button type="button" class="alt">先不要</button><button type="button" class="ok">好了</button></div></div>';
    var input = m.querySelector('input');
    input.value = getName();
    function close() { m.remove(); }
    m.querySelector('.alt').onclick = function () { if (!getName()) ls('player', '玩家'); close(); };
    m.querySelector('.ok').onclick = function () {
      var n = clean(input.value) || '玩家';
      ls('player', n);
      if (entry) rename(entry, n);
      close();
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') m.querySelector('.ok').click(); });
    document.body.appendChild(m);
    setTimeout(function () { input.focus(); }, 50);
  }

  function rename(entry, name) {
    var k = boardKey(entry.game, entry.board);
    var list = ls(k) || [];
    list.forEach(function (x) { if (x.id === entry.id) x.name = name; });
    ls(k, list);
    entry.name = name;
    // 名字確定了才送線上（第一次玩會先問名字）
    if (!entry.sent) { entry.sent = true; remote(payload(entry)); }
    toast(entry, rankOf(entry));
  }

  function payload(e) {
    return { game: e.game, board: e.board || '', name: e.name, score: e.score, order: e.order, unit: e.unit || '' };
  }
  function rankOf(entry) {
    var list = sortList(ls(boardKey(entry.game, entry.board)) || [], entry.order);
    for (var i = 0; i < list.length; i++) if (list[i].id === entry.id) return i + 1;
    return 0;
  }

  var api = {
    /** 結算時呼叫。opts: { board, order: 'desc'|'asc', unit, silent } */
    submit: function (game, score, opts) {
      opts = opts || {};
      score = Number(score);
      if (!game || !isFinite(score)) return null;
      var entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        game: game, board: opts.board || '', score: score,
        order: opts.order === 'asc' ? 'asc' : 'desc', unit: opts.unit || '',
        name: getName(), t: Date.now()
      };
      var k = boardKey(game, entry.board);
      var list = sortList((ls(k) || []).concat([{ id: entry.id, name: entry.name || '玩家', score: score, t: entry.t }]), entry.order).slice(0, KEEP);
      ls(k, list);
      var boards = ls('boards:' + game) || [];
      if (boards.indexOf(entry.board) < 0) { boards.push(entry.board); ls('boards:' + game, boards); }
      ls('order:' + game, entry.order);
      ls('unit:' + game, entry.unit);

      if (opts.silent) { if (entry.name) { entry.sent = true; remote(payload(entry)); } return entry; }
      if (!entry.name) { askName(entry); }
      else { entry.sent = true; remote(payload(entry)); toast(entry, rankOf(entry)); }
      return entry;
    },

    /** 取排行榜。回傳 Promise<{ source: 'online'|'local', list: [{name, score, t}] }> */
    top: function (game, opts) {
      opts = opts || {};
      var known = opts.order || ls('order:' + game);
      var local = { source: 'local', list: localTop(game, { board: opts.board, order: known || 'desc', limit: opts.limit }) };
      if (!ENDPOINT) return Promise.resolve(local);
      var url = ENDPOINT + '?game=' + encodeURIComponent(game) + '&board=' + encodeURIComponent(opts.board || '') +
        (known ? '&order=' + known : '') + '&limit=' + (opts.limit || 10);
      return fetch(url).then(function (r) { return r.json(); })
        .then(function (d) { return { source: 'online', list: d.list || [], boards: d.boards, order: d.order, unit: d.unit }; })
        .catch(function () { return local; });
    },

    /** 這台裝置玩過的榜（難度）清單 */
    boards: function (game) { return ls('boards:' + game) || ['']; },
    meta: function (game) { return { order: ls('order:' + game) || 'desc', unit: ls('unit:' + game) || '' }; },
    online: function () { return !!ENDPOINT; },
    playerName: getName,
    setPlayerName: function () { askName(null); }
  };

  window.SCGames = api;
})();
