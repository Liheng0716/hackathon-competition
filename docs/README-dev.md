# 机鉴 · 开发约定（谁改哪、怎么提）

> 本文件是目录边界的唯一依据。越界改别人的目录，PR 直接拒。
> 六人分工见 `docs/任务书/09-六人分工总表.md`；每人只看自己的 `派发-队员X.md`。

## 一、仓库与分支

| 仓库 | 用途 | 地址 |
|---|---|---|
| GitHub 主仓 | PR 与代码评审，main 受保护 | https://github.com/xcr2795576719-dot/hackathon-competition |
| Gitee 镜像 | 国内 clone/pull 加速 + 比赛提交系统填这个链接 | https://gitee.com/its-a-shame/hackathon-competition |

1. 克隆走 Gitee：`git clone https://gitee.com/its-a-shame/hackathon-competition.git`
2. 进仓库后追加 GitHub 远端实现双推：
   ```bash
   git remote set-url --add origin https://github.com/xcr2795576719-dot/hackathon-competition.git
   git remote -v   # origin 应有两行 fetch、两行 push
   ```
3. 任何人不许直推 main。分支命名：`feat/<泳道>-<模块>`，如 `feat/fe-prices`、`feat/api-storage`
4. 提交信息：`<模块>: <一句话>`，如 `prices: 新机走势图接入数据`
5. PR 开在 GitHub；队长每晚 21:00 合并并向两个远端双推

## 二、目录归属（目录即边界）

| 路径 | 归属 | 说明 |
|---|---|---|
| `app/page.tsx` | A 泳道1A | 首页：品牌筛选 + 机型卡片 |
| `app/prices/**`, `components/prices/**` | A 泳道1A | 行情详情页与图表 |
| `app/verify/**`, `app/report/**`, `components/verify/**`, `components/report/**` | B 泳道1B | 验机页、报告页 |
| `app/api/**`, `lib/data.ts`, `lib/estimate.ts` | C 泳道2（周三起 D 接棒） | 五个 API + 读写层 + 估价引擎 |
| `lib/ai.ts` | E 泳道3 | OpenAI 兼容适配层（其他泳道只调用，不改） |
| `docs/prompts/**`, `data/reports/**`, `data/knowledge.json` | E 泳道3 | 提示词、报告预生成、知识库 |
| `data/*.json`（models/prices/used） | D 数据组长**经脚本** | **禁止手改 JSON**，唯一入口 `scripts/import_prices.py` / `scripts/import_used.py` |
| `prices_history.csv` `prices_current.csv` | D 数据组长 | 人工查价填这里，再跑 import |
| `scripts/**` | 各泳道只加自己的脚本 | 见下表 |
| `docs/**` `deploy/**` `README.md` | 队长 | 只读 |
| `app/layout.tsx` `app/globals.css` `tailwind.config.ts` `package.json` | 队长 | 需要改先提 issue |

脚本归属：`import_prices.py`（D）、`import_used.py`（C/D）、`gen_reports.py` `test_model_apis.py`（E）、`jd_price_fetch.mjs`（E，P4 可砍）、`seed_data.mjs` `make_submit_zip.mjs`（队长）。

## 三、本地开发

```bash
cp .env.example .env      # 填 ZHIPU_KEY / DASHSCOPE_KEY（只在本机，别提交）
npm install
npm run dev               # http://localhost:3000
npm run build             # 提 PR 前必须本地过一遍
npm run seed              # 重生成种子数据（固定种子，覆盖 data 三个文件）
npm run submit            # 打 AI Works 上传包（自动排除 node_modules/.env/.next）
```

## 四、数据与 API 契约

- 数据文件结构见 `docs/任务书/00-全员必读.md`「数据文件结构」一节，字段名不得改
- 识机 API 返回固定结构：
  ```json
  {"category":"手机","model_guess":"iPhone 13","confidence":86,
   "visible_defects":[{"area":"屏幕","type":"划痕","severity":"轻微","detail":"右下角细划"}],
   "condition_score":85,"notes":"整体良好"}
  ```
- 报告 JSON：`{ model_id, generated_at, verdict(buy|wait|avoid), verdict_reason, price_position, pros[], cons[], pitfalls[], sources[{title,url}] }`
- 估价系数：99新 0.92 / 95新 0.85 / 9成新 0.76 / 8成新 0.65 / 大修 0.5（基准=95新中位价），修正项 拆修 -8% / 进水 -15% / 无盒配 -3%
- AI 统一走 `lib/ai.ts` 的 `aiChat(messages, opts)` / `aiVision(imageB64, prompt)`，不要各写各的 fetch
- 结构化输出提示词末尾必须加：「只输出 JSON，不要任何多余文字」

## 五、成色五档（唯一口径）

99新 / 95新 / 9成新 / 8成新 / 大修或功能缺陷 —— 字段名 `grade`，配色见 `tailwind.config.ts` 的 `grade` 色板（99新绿 #16a34a / 95新蓝 #2563eb / 9成新黄 #eab308 / 8成新橙 #f97316 / 大修红 #dc2626）。
