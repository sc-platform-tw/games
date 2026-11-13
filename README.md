# SC 平台 · 遊戲大廳

在 claude.ai chat 做的小遊戲，集中放在這裡，用 GitHub Pages 發佈：

**https://sc-platform-tw.github.io/games/**

## 結構

```
index.html                 大廳：讀 games.json 顯示卡片、標籤篩選、最新在前
play.html                  遊戲外框頁：上方「← 回大廳」列 + iframe 載入遊戲
leaderboard.html           排行榜頁：選遊戲、選難度榜
shared/score.js            共用分數工具：遊戲結算時呼叫 SCGames.submit()
CLAUDE.md                  給其他 Claude 對話的上架規則
games/<slug>/index.html    一款遊戲一個資料夾，單一 HTML 自包含
games/<slug>/cover.png     縮圖（可選，建議 800×500）
scripts/build-index.mjs    掃 games/*/index.html → 產生 games.json
scripts/make-covers.mjs    沒有 cover.png 的遊戲用 Playwright 截圖 → cover.auto.png
scripts/add-game.mjs       上架一個遊戲檔（.html / .jsx）
scripts/serve.mjs          本機靜態伺服器（模擬 /games/ 路徑）
.github/workflows/pages.yml  push 到 main 就部署
inbox/                     剛從 chat 下載、還沒上架的遊戲（不進 git、不部署）
```

`games.json` 與 `cover.auto.png` 都是產生出來的，不進 git；部署時 CI 會重建。

## 遊戲資訊寫在遊戲自己的 `<head>`

```html
<title>亮燈反應</title>
<meta name="description" content="等燈變綠再按！五回合測你的反應時間。">
<meta name="game:tags" content="反應力,休閒,單人">
<meta name="game:added" content="2026-11-13">
```

缺欄位時 `build-index.mjs` 會補：名稱 → 資料夾名；上架日期 → git 首次加入該檔的日期（沒有就用今天）；
說明 → 空白；標籤 → 無。縮圖順序：`cover.png` → `cover.auto.png` → 大廳自動畫一個色塊加首字。

slug（資料夾名）只能用小寫英數與 `-`，會出現在網址上：`play.html?g=<slug>`。

## 怎麼「回大廳」

大廳的卡片連到 `play.html?g=<slug>`：上方一條固定列有「← 回大廳」與「全螢幕開 ↗」，下方 iframe 載入遊戲。
選這個做法是因為**不用改遊戲本身**，遊戲跟大廳同網域，`localStorage` 照常可用。
`play.html` 只接受 `games.json` 裡有的 slug，不能拿來嵌任意網址。
想直接玩（例如遊戲在 iframe 裡鍵盤抓不到焦點），點「全螢幕開 ↗」會在新分頁開 `games/<slug>/`。

## 上架流程

1. 在 claude.ai chat 做好遊戲 → 下載 artifact 檔（`.html` 或 `.jsx`）。
2. 把檔案放進 `inbox/`。
3. 兩種上架方式擇一：
   - **請 Claude Code**：在這個資料夾對 Claude Code 說「上架 inbox 的遊戲」。它會：取 slug、建 `games/<slug>/`、
     必要時把 `.jsx` 轉成單一 HTML、補 `<head>` 的 meta（名稱 / 說明 / 標籤會問你或先擬好給你看）、
     檢查相容性、本機開起來試玩、給你 commit 草稿，你說可以才 commit。
   - **自己跑腳本**：
     ```bash
     node scripts/add-game.mjs inbox/MyGame.jsx my-game --title "我的遊戲" --desc "一句話說明" --tags "益智,單人"
     ```
4. 本機試玩：
   ```bash
   node scripts/build-index.mjs
   node scripts/serve.mjs        # 開 http://localhost:8080/games/
   ```
5. 確認 OK → 從 `inbox/` 刪掉原檔 → commit → push 到 `main`，幾分鐘後 Pages 更新。

## 相容性（從 claude.ai 搬到 Pages 要注意）

- **React（.jsx）artifact 要轉成單一 HTML**。`add-game.mjs` 的做法：Tailwind CDN + React 18.3.1（esm.sh）+
  Babel standalone 在瀏覽器編譯 JSX；`import` 第三方套件（例如 `lucide-react`）會改指 esm.sh。
  這是「盡量能跑」的自動轉換，第一次載入會稍慢，**一定要本機試玩**；若遊戲用到 shadcn/ui（`@/components/ui/...`）
  這種 claude.ai 內建元件，自動轉換做不到，需要改寫或請 Claude Code 處理。想要更快可改用打包工具（Vite 等）輸出單一 HTML。
- **`window.claude` 等 claude.ai 專用 API 在 Pages 上不能用**。存檔一律改用 `localStorage`
  （key 建議加前綴 `sc-games:<slug>:`，避免各遊戲互相覆蓋，因為同網域共用）；
  呼叫 AI 的功能（`window.claude.complete` 之類）要拿掉。
- **不可放任何 API key / token**。這是公開 repo、公開網站，任何寫進去的 key 等於公開。`add-game.mjs` 會掃常見 key 樣式並警告。
- 外部資源只從 CDN 載（cdnjs / jsDelivr / unpkg / esm.sh）；圖片、音效等放在 `games/<slug>/` 底下用相對路徑。
- 不放全名、照片、生日等個資。

## 排行榜

遊戲在 `<head>` 載入 `../../shared/score.js`，結算時呼叫一次：

```js
window.SCGames && SCGames.submit('<slug>', score);                              // 越高越好
window.SCGames && SCGames.submit('<slug>', moves, { order: 'asc', unit: '步' }); // 越低越好
```

第一次會請玩家輸入名字，之後在畫面下方顯示名次與「看排行榜」連結。

- **預設：本機排行榜**，存在各裝置的 `localStorage`，不用任何設定。
- **線上排行榜（Google 試算表）**：照 `scripts/leaderboard-apps-script.gs` 開頭的 4 個步驟部署，
  把網址填進 `shared/score.js` 的 `ENDPOINT` 後 push。分數會寫進試算表，可直接打開查看或刪除。

## 縮圖

- 想固定縮圖：放 `games/<slug>/cover.png`（建議 800×500）並 commit。
- 沒放的話，CI 部署時 `make-covers.mjs` 會用 Playwright 開遊戲截圖（遊戲開頭畫面）。
- 本機也能跑：
  ```bash
  npm install
  npx playwright install chromium
  node scripts/make-covers.mjs
  ```
  沒安裝 Playwright 時腳本會直接略過，大廳顯示色塊。

## 部署（GitHub Pages）

`.github/workflows/pages.yml`：push 到 `main`（或手動 Run workflow）→ 安裝 Playwright → 補縮圖 → 產生 `games.json`
→ 組 `_site/`（只放 `index.html`、`play.html`、`games.json`、`games/`；`inbox/`、`scripts/` 不部署）
→ `actions/upload-pages-artifact` + `actions/deploy-pages`。

第一次要在 repo 的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
