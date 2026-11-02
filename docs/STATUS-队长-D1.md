# 队长执行状态（D1 今晚 21:55）

## 已完成（可直接验收）
1. 仓库骨架：Next 14.2.35 App Router + TS + Tailwind 3.4 + ECharts 5.6，`npm install` 已装好（node_modules 339 包）
2. 目录/入口按任务书建齐：`app/prices/[model]`、`app/verify`、`app/report/[model]`、`app/api/{models,prices/[model],verify,report/[model],estimate}`、`lib/{ai,data,estimate}.ts`、`data/`、`docs/`、`deploy/`、`scripts/`
3. `lib/ai.ts`：aiChat / aiVision / parseJsonLoose，模型链（vision: glm-4v-flash→qwen3-vl-plus；deep: glm-5.3-flash→qwen-plus；默认 qwen-plus），每模型重试 1 次、失败切备选、全败返回 { error }
4. 数据：20 款机型（T1 6 + T2 14）、20 条现价、6 款 30 天历史、77 条二手样本（五档齐全）、20 条避坑知识、6 份 T1 报告；全部由 `scripts/seed_data.mjs` 与 `scripts/gen_reports.py` 生成（禁止手改 JSON）
5. 五泳道产出全部落盘：首页/行情页/验机页/报告页、五个 API、估价引擎、提示词、报告生成与回归脚本
6. 构建与自检：`tsc --noEmit` 0 error；`next build` 通过（25 页，exit 0）；`next start` 起来后四条页面链路 200
7. API 实测（本机 127.0.0.1:3000）：/api/models、/api/prices/iphone-13-128g、/api/report/iphone-13-128g、/api/estimate（95新 → 2750/2990/3230 + 6 条 basis）、/api/verify（真调 glm-4v-flash 返回 JSON）
8. 部署材料：`deploy/README.md`（AI Works 主线 + ¥68/年 杭州兜底 + IP:3000 直连）、`deploy/pull_data.sh`、`deploy/Caddyfile`、`scripts/make_submit_zip.mjs`（`npm run submit`）
9. 数据入库脚本：`scripts/import_prices.py`（历史价/现价合并、幂等、原子写、unknown model 落 skipped.csv）

## 还差什么（需要你动手）
1. **git push 需要你的凭据**：本机没有 GitHub/Gitee token，push 被拒（SEC_E_NO_CREDENTIALS）。执行：
   ```bash
   git remote set-url origin https://TOKEN@github.com/xcr2795576719-dot/hackathon-competition.git
   git push -u origin main
   git remote set-url --add origin https://xcr2795576719-dot:TOKEN_GITEE@gitee.com/its-a-shame/hackathon-competition.git
   git push origin main
   ```
2. GitHub 分支保护 + 5 人 collaborator（网页）；Gitee 保护分支 main
3. 把 `任务书/派发-队员A~E.md` 五份发给对应队员；ZHIPU/DASHSCOPE key 只发 C、E
4. 周三 12:00 前 AI Works 提审（`npm run submit` 出包 → 上传 → 填两把 key → 预览自测）

## 已知缺口
1. `data/*.json` 是种子数据（source=seed），真实价要 D 走 07 流程覆盖
2. `jd_url` 目前是京东搜索链接，拿到真实 SKU 后替换
3. 二手样本 77 条为种子，闲鱼油猴采集后由 `scripts/import_used.py` 覆盖
4. `scripts/jd_price_fetch.mjs`（08 京东抓取，P4 可砍）尚未写，D3 决定
5. 本机沙箱下 next build 需提权（fork worker 被拒 EPERM），队友在自己的机器上应该正常；若同样报错，用 `npm run build` 在普通终端跑
