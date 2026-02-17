---
name: digest
description: "Multi-domain AI-powered RSS digest. Supports multiple profiles (ai, quant, etc.) to fetch domain-specific RSS feeds, score/filter articles with AI, and generate daily digests in Markdown. Use when user mentions 'daily digest', 'RSS digest', 'blog digest', 'AI blogs', 'quant digest', 'tech news summary', or asks to run /digest command. Trigger command: /digest."
---

# AI Daily Digest

支援多領域的 AI 每日精選摘要產生器。透過 profile 機制，可切換不同領域（AI/技術、量化金融等），抓取對應 RSS 來源並以 AI 評分篩選。

## 指令

### `/digest`

執行每日摘要產生器（預設使用 AI/技術 profile）。

### `/digest ai`

執行 AI/技術領域摘要（來自 Karpathy 推薦的 90 個頂級技術部落格）。

### `/digest quant`

執行量化金融領域摘要（量化交易、風控、市場微結構等）。

**使用方式**：輸入 `/digest` 或 `/digest <profile>`，Agent 透過互動引導收集參數後執行。

---

## 腳本目錄

**重要**：所有腳本位於 `~/.claude/skills/digest/scripts/`。

| 檔案 | 用途 |
|------|------|
| `scripts/digest.ts` | 主腳本 — RSS 抓取、AI 評分、產生摘要 |
| `profiles/ai.json` | AI/技術領域 profile |
| `profiles/quant.json` | 量化金融領域 profile |

---

## 設定持久化

設定檔路徑：`~/.hn-daily-digest/config.json`

Agent 在執行前**必須檢查**此檔案是否存在：
1. 若存在，讀取並解析 JSON
2. 詢問使用者是否使用已儲存的設定
3. 執行完成後儲存目前設定到此檔案，並設定 `chmod 600 ~/.hn-daily-digest/config.json` 保護 API Key

**設定檔結構**：
```json
{
  "anthropicApiKey": "",
  "geminiApiKey": "",
  "openaiApiKey": "",
  "openaiApiBase": "",
  "openaiModel": "",
  "timeRange": 48,
  "topN": 15,
  "language": "zh",
  "lastUsed": "2026-02-16T12:00:00Z"
}
```

---

## 互動流程

### Step 0：檢查已儲存設定

```bash
cat ~/.hn-daily-digest/config.json 2>/dev/null || echo "NO_CONFIG"
```

若設定存在且有 API Key，詢問使用者：

> 偵測到上次使用的設定：
> - 時間範圍：{timeRange} 小時
> - 精選數量：{topN} 篇
> - 輸出語言：{language === 'zh' ? '中文' : 'English'}
>
> 請問要使用上次設定直接執行，還是重新設定？

### Step 1：選擇 Profile 和收集參數

若使用者輸入 `/digest` 未指定 profile，詢問：

**領域 Profile** — 要產生哪個領域的摘要？
- AI/技術（推薦，90 個技術部落格）→ `--profile ai`
- 量化金融（20 個量化金融部落格）→ `--profile quant`

若使用者輸入 `/digest ai` 或 `/digest quant`，則直接使用指定的 profile。

依序詢問使用者以下設定（若使用者選擇沿用上次設定則跳過）：

**時間範圍** — 抓取多長時間內的文章？
- 24 小時（僅最近一天）
- 48 小時（推薦，涵蓋較全）
- 72 小時（最近三天）
- 7 天（一週內的文章）

**精選數量** — AI 篩選後保留幾篇？
- 10 篇（精簡版）
- 15 篇（推薦）
- 20 篇（擴展版）

**輸出語言** — 摘要使用什麼語言？
- 中文（推薦）
- English

### Step 1b：AI API Key（Anthropic 優先，Gemini 備援）

若設定中沒有任何已儲存的 API Key，請告知使用者：

> 請提供 AI API Key。優先順序：Anthropic Claude → Gemini → OpenAI-compatible。
> - Anthropic：使用 `ANTHROPIC_API_KEY`（優先級最高）
> - Gemini：前往 https://aistudio.google.com/apikey 建立免費 API Key
> - OpenAI-compatible：設定 `OPENAI_API_KEY`（可搭配 `OPENAI_API_BASE` 用於 DeepSeek 等）

若 `config.anthropicApiKey` 或 `config.geminiApiKey` 已存在，跳過此步。

### Step 2：執行腳本

```bash
mkdir -p ./output

# API keys（優先順序：Anthropic → Gemini → OpenAI-compatible）
# 也可以在 ~/.hn-daily-digest/config.json 中設定，env vars 優先
export ANTHROPIC_API_KEY="<anthropic-key>"   # 最高優先
export GEMINI_API_KEY="<key>"                # 備援
# 可選：OpenAI 相容備援（DeepSeek/OpenAI 等）
export OPENAI_API_KEY="<fallback-key>"
export OPENAI_API_BASE="https://api.deepseek.com/v1"
export OPENAI_MODEL="deepseek-chat"

npx -y bun ~/.claude/skills/digest/scripts/digest.ts \
  --profile <ai|quant> \
  --hours <timeRange> \
  --top-n <topN> \
  --lang <zh|en> \
  --output ./output/digest-<profile>-$(date +%Y%m%d).md \
  --heptabase  # 可選：自動存入 Heptabase card
```

### Step 2b：儲存設定

```bash
mkdir -p ~/.hn-daily-digest
cat > ~/.hn-daily-digest/config.json << 'EOF'
{
  "anthropicApiKey": "<anthropic-key>",
  "geminiApiKey": "<key>",
  "openaiApiKey": "",
  "openaiApiBase": "",
  "openaiModel": "",
  "timeRange": <hours>,
  "topN": <topN>,
  "language": "<zh|en>",
  "lastUsed": "<ISO timestamp>"
}
EOF
chmod 600 ~/.hn-daily-digest/config.json
```

### Step 3：結果展示

**成功時**：
- 報告檔案路徑
- 簡要摘要：掃描源數、抓取文章數、精選文章數
- **今日精選 Top 3 預覽**：中文標題 + 一句話摘要
- **RSS 錯誤 log**：若有 feed 抓取失敗，會產生 `digest-{profile}-YYYYMMDD-errors.log` 於 output 同目錄
- **Heptabase 儲存狀態**：若啟用 `--heptabase`，顯示是否成功存入 Heptabase card

**報告結構**（產生的 Markdown 檔案包含以下區塊）：
1. **今日看點** — AI 歸納的 3-5 句宏觀趨勢總結
2. **今日必讀 Top 3** — 中英雙語標題、摘要、推薦理由、關鍵詞標籤
3. **數據概覽** — 統計表格 + Mermaid 分類圓餅圖 + 高頻關鍵詞柱狀圖 + ASCII 純文字圖 + 話題標籤雲
4. **分類文章列表** — 按 profile 定義的分類分組展示

**失敗時**：
- 顯示錯誤訊息
- 常見問題：API Key 無效、網路問題、RSS 來源無法存取

---

## 參數對應

| 互動選項 | 腳本參數 |
|----------|----------|
| AI/技術 | `--profile ai`（預設） |
| 量化金融 | `--profile quant` |
| 24 小時 | `--hours 24` |
| 48 小時 | `--hours 48` |
| 72 小時 | `--hours 72` |
| 7 天 | `--hours 168` |
| 10 篇 | `--top-n 10` |
| 15 篇 | `--top-n 15` |
| 20 篇 | `--top-n 20` |
| 限制 RSS 來源數 | `--feeds <n>`（預設抓全部，測試時可用 `--feeds 3`） |
| 中文 | `--lang zh` |
| English | `--lang en` |
| 存入 Heptabase | `--heptabase`（需已安裝 heptabase CLI 並登入） |

---

## 環境需求

- `bun` 執行環境（透過 `npx -y bun` 自動安裝）
- 至少一個 AI API Key（`ANTHROPIC_API_KEY`、`GEMINI_API_KEY` 或 `OPENAI_API_KEY`）
- API Key 可透過環境變數或 `~/.hn-daily-digest/config.json` 設定（env vars 優先）
- Provider 優先順序：Anthropic Claude → Gemini → OpenAI-compatible（自動降級）
- 可選：`OPENAI_API_BASE`、`OPENAI_MODEL`（用於 OpenAI 相容介面）
- 可選：Heptabase CLI（`heptabase auth login`）— 啟用 `--heptabase` 時需要
- 網路存取（需能存取 RSS 來源和 AI API）

---

## 可用 Profiles

### `ai` — AI/技術（預設）
90 個 RSS 來源取自 [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/)，由 [Andrej Karpathy](https://x.com/karpathy) 推薦。包括：simonwillison.net、paulgraham.com、overreacted.io、gwern.net、krebsonsecurity.com 等頂級技術部落格。

分類：AI/ML、安全、工程、工具/開源、觀點/雜談、其他

### `quant` — 量化金融
20 個量化金融相關 RSS 來源，涵蓋 Quantocracy、QuantStart、Alpha Architect、AQR Insights 等。

分類：Alpha 研究、市場微結構、風控、量化工具、總經評論、其他

---

## 新增自訂 Profile

在 `profiles/` 目錄下新增 `<name>.json`，結構參考 `profiles/ai.json`。主要欄位：

- `feeds` — RSS 來源列表
- `categories` — 分類定義（ID、emoji、label）
- `prompts` — AI 評分和摘要的領域用語
- `report` — 報告標題、副標題、footer

---

## 疑難排解

### "Profile not found"
確認 `profiles/<name>.json` 存在。執行 `--help` 可查看可用的 profiles。

### "Missing API key"
需要至少一個 API Key。設定 `ANTHROPIC_API_KEY`（推薦）、`GEMINI_API_KEY`（免費）或 `OPENAI_API_KEY`。
也可以在 `~/.hn-daily-digest/config.json` 中設定。

### "Anthropic/Gemini 請求失敗"
腳本會自動降級到下一個可用的 provider（Anthropic → Gemini → OpenAI-compatible）。

### "Failed to fetch N feeds"
部分 RSS 來源可能暫時無法存取，腳本會跳過失敗的來源並繼續處理。

### "No articles found in time range"
嘗試擴大時間範圍（如從 24 小時改為 48 小時）。
