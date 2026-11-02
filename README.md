# 机鉴 · 数码行情与避坑决策平台

查行情（新机/二手价格）→ 拍照验机（识型号、评成色、标瑕疵）→ AI 读评测 → 一页报告告诉你「这台机器现在买值不值、有没有坑」。

- 镜像仓（国内加速 / 比赛提交链接）：https://gitee.com/its-a-shame/hackathon-competition
- 主仓（PR 与评审）：https://github.com/xcr2795576719-dot/hackathon-competition

## 技术栈（定稿，不换）

Next.js 14 App Router + TypeScript + Tailwind CSS｜ECharts（echarts-for-react）｜纯 JSON 文件存储（`data/`）｜OpenAI 兼容 AI 适配层（`lib/ai.ts`）：视觉 `glm-4v-flash` → 备选 `qwen3-vl-plus`；文本 `qwen-plus` / 深度 `glm-5.3-flash`

## 快速开始

```bash
cp .env.example .env      # 填 ZHIPU_KEY / DASHSCOPE_KEY
pnpm install
pnpm dev
```

## 结构

```
app/page.tsx                 首页（品牌筛选 + 机型卡片）
app/prices/[model]/          行情页（走势 / 二手散点 / 现价）
app/verify/                  拍照验机
app/report/[model]/          AI 决策报告
app/api/                     models / prices / verify / report / estimate
lib/ai.ts                    AI 适配层（重试 + 备选模型切换）
lib/data.ts lib/estimate.ts  JSON 读写、估价引擎
data/                        models / prices_current / prices_history / used_samples / knowledge / reports
docs/                        任务书、提示词、开发约定
deploy/                      Caddy + pm2 + 自动拉取脚本（服务器部署）
tools/                       种子数据生成
```

## 数据口径

| 文件 | 内容 |
|---|---|
| `data/models.json` | 20 款机型目录（T1 深度 6 + T2 行情 14，T3 目录后补到 100） |
| `data/prices_current.json` | 各机型新机现价 `{jd, captured_at, source}` |
| `data/prices_history.json` | 仅 T1 六款的 30 天新机价 |
| `data/used_samples.json` | 二手样本，`grade` 归一到五档（99新/95新/9成新/8成新/大修或功能缺陷） |
| `data/reports/<model_id>.json` | AI 报告缓存（生成物，不入库） |
| `data/knowledge.json` | 避坑知识条目 |

> 当前 `data/*.json` 为 `pnpm seed` 生成的种子数据（`source: seed`），接真实采集后由 `scripts/` 覆盖。

## 部署

见 `deploy/README.md`：阿里云轻量（香港）+ Caddy 自动 HTTPS + pm2 + 每小时 `git pull --ff-only` 自动更新。

## 协作

目录边界、分支规矩、API 契约见 `docs/README-dev.md`；任务书见 `docs/任务书/`。
