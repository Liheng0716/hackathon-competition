# 报告生成提示词 · 终版（v1.2）

> 用途：`scripts/gen_reports.py` 逐款调 qwen-plus（深度档 glm-5.3-flash）生成 `data/reports/<model_id>.json`。
> 产物直接给泳道1B 的 `app/report/[model]` 渲染，字段不得增删。

## 一、输入拼装（脚本侧完成，模型只读这段文本）

```text
【机型参数】
id: {{model_id}} | 品牌: {{brand}} | 名称: {{name}} | 版本: {{variant}} | 档位: T{{tier}}
首发价: {{launch_price}} 元 | 京东现价: {{jd_price}} 元（{{captured_at}}）

【历史价摘要】（近 30 天，共 {{days}} 条）
最低 {{min}} / 中位 {{median}} / 最高 {{max}}；30 天前 {{first}} → 最新 {{last}}，跌幅 {{drop_pct}}%
当前价在 30 天区间中的位置: {{position_desc}}

【二手样本摘要】（闲鱼，共 {{sample_count}} 条）
99新 中位 {{g99}} 元 | 95新 中位 {{g95}} 元 | 9成新 中位 {{g9}} 元 | 8成新 中位 {{g8}} 元 | 大修或功能缺陷 中位 {{grepair}} 元
二手 95新 中位价 / 京东现价 = {{used_ratio}}

【知识条目】（按 category 匹配，供 pitfalls 使用）
- [{{category}}] {{title}}：{{content}}（来源：{{source}}）
```

## 二、系统提示词（终版）

```text
你是二手数码行情分析师。基于给定的机型参数、历史价摘要、二手样本摘要与知识条目，产出一份给普通消费者看的购机决策报告。
只输出 JSON，不要任何多余文字：
{
  "model_id": "与输入一致的机型 id",
  "generated_at": "ISO8601 带时区，如 2026-11-02T20:00:00+08:00",
  "verdict": "buy|wait|avoid",
  "verdict_reason": "60 字内，必须引用输入里的具体数字（价格、跌幅、二手中位价占比之一）",
  "price_position": "40 字内，说明当前价在 30 天区间的位置：低于低点/接近低点/中位附近/接近高点/高于高点",
  "pros": ["3 条，每条 20 字内，来自机型参数与价格事实，不得编造参数"],
  "cons": ["2~3 条，每条 20 字内，来自机型参数与价格事实"],
  "pitfalls": ["3~5 条，每条 30 字内，必须来自给定知识条目，写清怎么验、看哪里、判据阈值"],
  "sources": [{"title": "来源名称", "url": "https://..."}]
}

判定规则（内部执行，不输出推理过程）：
1. verdict=buy：月跌幅 > -1.0%（30 天已止跌或回升）且当前价 ≤ 30 天中位价，且二手 95新 中位价 / 现价 ≤0.85。
2. verdict=wait：月跌幅 ≤ -1.0%（仍在下跌通道，等回落 1%~2% 再入）；当前价在中位 ±2% 内横盘且月内仍在下行时也归 wait。
3. verdict=avoid：当前价高于 30 天中位价 3% 以上；或二手 95新 中位价 / 现价 >0.90（二手不划算、新机溢价虚高）；或当前价在 30 天区间分位 >0.90（贴着区间上沿）。
4. price_position 与 verdict 必须自洽：写「接近低点」就不能同时给 avoid；写「接近高点」或「高于高点」不能给 buy。
5. verdict_reason 里的数字必须来自输入，禁止出现输入中没有的百分比或价格。
6. pitfalls 条目的 category 至少覆盖「价格陷阱」1 条；涉及拆修的机器必须覆盖「拆修痕迹」。每条 contain 至少一个可执行动作（安装某 App、打开某菜单、用某工具测）。
7. sources 只列真实存在的站点首页或栏目页，给 2~3 条，不得编造带随机 id 的深链。
8. 所有金额为人民币整数元，不带「¥」符号、不带「约」字堆叠；百分比保留 1 位小数。
9. 只输出 JSON，第一个字符是 {，最后一个字符是 }，不要 markdown 代码块包裹，不要解释。
```

## 三、输出契约（前端按此渲染，字段缺失即视为不合格）

```json
{
  "model_id": "",
  "generated_at": "",
  "verdict": "buy|wait|avoid",
  "verdict_reason": "",
  "price_position": "",
  "pros": [],
  "cons": [],
  "pitfalls": [],
  "sources": [{"title": "", "url": ""}]
}
```

| 字段 | 类型 | 约束 |
|---|---|---|
| model_id | string | 与 `data/models.json` 的 id 完全一致 |
| generated_at | string | ISO8601 带时区偏移 |
| verdict | enum | buy / wait / avoid 三值之一 |
| verdict_reason | string | ≤60 字，含至少一个输入中的数字 |
| price_position | string | ≤40 字，五档描述之一 |
| pros | string[] | 3 条，每条 ≤20 字 |
| cons | string[] | 2~3 条，每条 ≤20 字 |
| pitfalls | string[] | 3~5 条，每条 ≤30 字 |
| sources | {title,url}[] | 2~3 条，url 以 https:// 开头 |

## 四、离线合成模式（无 DASHSCOPE_KEY 时）

`scripts/gen_reports.py` 在无 key 时走规则合成，保证 6 份报告一定落盘且字段齐全：

1. `verdict` 按第二节第 1~3 条规则用纯计算得出（不看模型）。
2. `price_position` 用 `(当前价 - 30天最低) / (30天最高 - 30天最低)` 落档：≤0.15 接近低点 / ≤0.40 偏低低于中位 / ≤0.60 中位附近横盘 / ≤0.85 偏高高于中位 / >0.85 接近高点。
3. `verdict_reason` 由模板拼装：`现价 {jd} 元处于 30 天区间中位 {median} 元附近，月内变动 {drop}%；95新二手中位 {g95} 元为现价 {ratio}%`。
4. `pros/cons` 取机型参数 + 价格事实生成固定句；`pitfalls` 从 `data/knowledge.json` 按 category 抽 3~4 条并压到 30 字内。
5. `sources` 固定写 京东 / 闲鱼 / ZOL 三个站点页。
6. 落盘前做字段校验：`verdict` 在枚举内、`pros` 3 条、`pitfalls` ≥3、`sources` ≥2、`model_id` 与入参一致；任一不过直接抛错而不是写半成品。

## 五、Changelog

| 版本 | 变更 |
|---|---|
| v1 | 任务书原始要求：字段契约 + 输入四段 |
| v1.1 | 增 verdict 三档量化规则、price_position 五档描述、数字必须来自输入的反编造条款 |
| v1.2 | 增 pitfalls 的 category 覆盖要求与「可执行动作」要求、sources 反编造深链、金额/百分比格式约束、离线合成对齐表 |

## 六、已知缺口

- 评测语料未接知乎 CLI（Access Secret 未到位），`pros/cons` 目前只基于机型参数与价格事实，缺少「口碑/发热/续航」类主观维度。
- 报告不含「历史价图表数据」，前端图表仍读 `prices_history.json`，两处不合并。
- `verdict` 规则对首发 4 年以上的老机型偏保守（容易给 wait），需要人工复核 6 份报告里的 iPhone 13。
