# 給 Claude 的上架規則（sc-platform-tw/games）

這個 repo 是 GitHub Pages 靜態遊戲大廳：https://sc-platform-tw.github.io/games/
使用者在別的對話做好喜歡的遊戲，會說「存進 repo」「上架」。照下面做，**大廳會自動收錄，不用改大廳**。

## 上架一款遊戲

1. **取得遊戲 HTML**：claude.ai artifact 就用 artifact 工具讀出完整 HTML（不要憑記憶重寫）；
   使用者給檔案就用檔案。`.jsx` 走 `node scripts/add-game.mjs`（見 README）。
2. **取 slug**：小寫英數與 `-`，例如 `crazy-kitchen`。放在 `games/<slug>/index.html`，單一自包含 HTML。
   已存在同名資料夾就換名字或問使用者是否覆蓋。
3. **`<head>` 補上架資訊**（大廳靠這些產生卡片）：
   ```html
   <title>遊戲名稱</title>
   <meta name="description" content="一句話說明怎麼玩">
   <meta name="game:tags" content="類型,單人,排行榜">
   <meta name="game:added" content="YYYY-MM-DD">
   ```
   標籤盡量沿用現有的（反應力、休閒、益智、動作、派對、經營、記憶、單人…），有接分數就加「排行榜」。
4. **接排行榜**（遊戲有分數就要接）：
   - `<head>` 加 `<script src="../../shared/score.js"></script>`
   - 在「遊戲結束、結算畫面出現」的地方呼叫**一次**：
     ```js
     window.SCGames && SCGames.submit('<slug>', score);                              // 越高越好
     window.SCGames && SCGames.submit('<slug>', moves, { order: 'asc', unit: '步' }); // 越低越好
     window.SCGames && SCGames.submit('<slug>', score, { board: '困難' });            // 分難度各一張榜
     ```
   - 第一個參數一定要等於資料夾名 slug。不要動遊戲原本的玩法和自己的最高分紀錄。
   - `score.js` 會自己處理問名字、提示名次、連到 `leaderboard.html`；遊戲不用做 UI。
5. **相容性檢查**：
   - 不可有 `window.claude`、呼叫 AI API、任何 API key / token（公開 repo）。
   - 外部資源只用 CDN（cdnjs / jsDelivr / unpkg / esm.sh），自有圖片音效放 `games/<slug>/` 用相對路徑。
   - 自己的 `localStorage` key 不要跟別的遊戲撞（建議前綴 `sc-games:<slug>:`；舊遊戲已有的 key 不用改）。
   - 不放個資（全名、照片、生日）。
6. **本機驗證**：
   ```bash
   node scripts/build-index.mjs          # 確認新遊戲出現在清單、沒有缺欄位警告
   node scripts/serve.mjs                # http://localhost:8080/games/
   ```
   能跑瀏覽器就開 `games/<slug>/` 確認沒有 console error、結算時有呼叫 `SCGames.submit`。
7. **Commit 並推到 `main`**：一款遊戲一個 commit，訊息例如 `上架：瘋狂廚房（crazy-kitchen）`。
   push 後 GitHub Actions 會重建 `games.json`、截縮圖、部署 Pages，幾分鐘後上線。
   推送前先 `git pull --rebase`，其他對話可能同時在上架。

## 不要動 / 不要 commit

- `games.json`、`cover.auto.png` 是 CI 產生的（已在 `.gitignore`）。
- `inbox/` 不進版控。
- 大廳（`index.html`、`play.html`、`leaderboard.html`）、`shared/score.js`、workflow：除非使用者要求，否則上架時不要改。

## 排行榜模式

- 預設是**本機排行榜**（存在每台裝置的 `localStorage`）。
- 線上排行榜：照 `scripts/leaderboard-apps-script.gs` 開頭的步驟建 Google 試算表，
  把 Web App 網址填進 `shared/score.js` 的 `ENDPOINT`。之後所有遊戲自動改用線上榜，遊戲本身不用改。
