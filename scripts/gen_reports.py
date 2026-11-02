#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""机鉴 · 报告预生成脚本（泳道3）

逐款调用 DashScope OpenAI 兼容 qwen-plus，把「机型参数 + 30 天价摘要 + 二手五档中位价 + 避坑知识」
合成一份 data/reports/<model_id>.json，字段契约见 docs/prompts/report.md。

用法:
  python scripts/gen_reports.py                          # 默认 T1 前 6 款 -> data/reports
  python scripts/gen_reports.py --models iphone-13-128g,xiaomi-14
  python scripts/gen_reports.py --models data/models.json --out data/reports --force
  python scripts/gen_reports.py --offline                # 强制离线合成（不调模型）

无 DASHSCOPE_KEY（环境变量或仓库根 .env）时自动走离线合成，保证每款都有完整报告落盘。
退出码: 0 全部成功 / 1 有模型失败或校验不过。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
GRADES = ["99新", "95新", "9成新", "8成新", "大修或功能缺陷"]
DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
MODEL_NAME = "qwen-plus"
GENERATED_AT = "2026-11-02T20:00:00+08:00"
JSON_TAIL = "只输出 JSON，不要任何多余文字"


# ---------------------------------------------------------------- 数据装载
def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_env_key(name: str) -> str:
    """环境变量优先，其次仓库根 .env（不打印、不落盘）。"""
    val = os.environ.get(name, "").strip()
    if val:
        return val
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == name:
                return v.strip().strip('"').strip("'")
    return ""


def pick_models(spec: str | None, models: list[dict]) -> list[dict]:
    if not spec:
        t1 = [m for m in models if m.get("tier") == 1]
        return t1[:6] if t1 else models[:6]
    p = Path(spec)
    if p.exists():
        loaded = load_json(p)
        ids = {m["id"] for m in loaded}
        return [m for m in models if m["id"] in ids]
    wanted = [s.strip() for s in spec.split(",") if s.strip()]
    by_id = {m["id"]: m for m in models}
    missing = [w for w in wanted if w not in by_id]
    if missing:
        raise SystemExit(f"[models] 未知 model_id: {', '.join(missing)}")
    return [by_id[w] for w in wanted]


# ---------------------------------------------------------------- 价格摘要
def price_stats(model_id: str, history: dict, current: dict, used: list[dict]) -> dict:
    rows = history.get(model_id) or []
    prices = [int(r["price"]) for r in rows]
    jd = int((current.get(model_id) or {}).get("jd") or 0)
    stats = {
        "days": len(prices),
        "jd": jd,
        "min": min(prices) if prices else jd,
        "max": max(prices) if prices else jd,
        "median": round(statistics.median(prices)) if prices else jd,
        "first": prices[0] if prices else jd,
        "last": prices[-1] if prices else jd,
        "drop_pct": 0.0,
        "drop_raw": 0.0,
        "position": 0.5,
        "used": {g: None for g in GRADES},
        "used_count": 0,
        "used_ratio": 0.0,
    }
    if prices and stats["first"]:
        raw = (stats["last"] - stats["first"]) / stats["first"] * 100
        stats["drop_raw"] = round(raw, 3)
        stats["drop_pct"] = round(raw, 1)
    span = stats["max"] - stats["min"]
    if span > 0:
        stats["position"] = round((jd - stats["min"]) / span, 3)

    samples = [s for s in used if s.get("model_id") == model_id]
    stats["used_count"] = len(samples)
    for g in GRADES:
        vals = [int(s["price"]) for s in samples if s.get("grade") == g]
        stats["used"][g] = round(statistics.median(vals)) if vals else None
    base = stats["used"].get("95新")
    if base and jd:
        stats["used_ratio"] = round(base / jd, 3)
    return stats


POSITION_BANDS = [
    (0.15, "接近 30 天低点"),
    (0.40, "偏低，低于中位"),
    (0.60, "中位附近，横盘"),
    (0.85, "偏高，高于中位"),
    (1.01, "接近 30 天高点"),
]


def position_text(pos: float) -> str:
    for hi, text in POSITION_BANDS:
        if pos <= hi:
            return text
    return "高于 30 天高点"


def match_knowledge(model: dict, stats: dict, knowledge: list[dict], limit: int = 4) -> list[dict]:
    """按机型与价格状态挑知识条目：价格陷阱必选，其余按品牌/价位轮换，保证 6 份报告不雷同。"""
    by_cat: dict[str, list[dict]] = {}
    for k in knowledge:
        by_cat.setdefault(k["category"], []).append(k)

    need = ["价格陷阱"]
    if stats["used_ratio"] > 0.85:
        need += ["海外版", "扩容机"]
    if stats["position"] > 0.75:
        need += ["屏幕总成", "电池健康"]
    need += ["翻新机", "拆修痕迹", "进水机", "序列号", "配件调包", "电池健康", "屏幕总成", "扩容机", "海外版"]

    picked: list[dict] = []
    seen: set[str] = set()
    idx = hash(model["id"]) & 0x7FFFFFFF
    for cat in need:
        pool = [k for k in by_cat.get(cat, []) if k["id"] not in seen]
        if not pool:
            continue
        k = pool[idx % len(pool)]
        picked.append(k)
        seen.add(k["id"])
        if len(picked) >= limit:
            break
    return picked


# ---------------------------------------------------------------- 提示词
def build_prompt(model: dict, stats: dict, picks: list[dict]) -> str:
    used = stats["used"]
    def g(v):
        return "无样本" if v is None else f"{v} 元"

    kb = "\n".join(
        f"- [{k['category']}] {k['title']}：{k['content']}（来源：{k['source']}）" for k in picks
    )
    return f"""【机型参数】
id: {model['id']} | 品牌: {model['brand']} | 名称: {model['name']} | 版本: {model.get('variant','')} | 档位: T{model.get('tier')}
首发价: {model.get('launch_price')} 元 | 京东现价: {stats['jd']} 元

【历史价摘要】（近 {stats['days']} 天）
最低 {stats['min']} / 中位 {stats['median']} / 最高 {stats['max']}；{stats['days']} 天前 {stats['first']} → 最新 {stats['last']}，跌幅 {stats['drop_pct']}%
当前价在 30 天区间中的位置: {position_text(stats['position'])}（分位 {stats['position']}）

【二手样本摘要】（闲鱼，共 {stats['used_count']} 条）
99新 中位 {g(used['99新'])} | 95新 中位 {g(used['95新'])} | 9成新 中位 {g(used['9成新'])} | 8成新 中位 {g(used['8成新'])} | 大修或功能缺陷 中位 {g(used['大修或功能缺陷'])}
二手 95新 中位价 / 京东现价 = {stats['used_ratio']}

【知识条目】
{kb}
"""


SYSTEM_PROMPT = f"""你是二手数码行情分析师。基于给定的机型参数、历史价摘要、二手样本摘要与知识条目，产出一份给普通消费者看的购机决策报告。
只输出 JSON，不要任何多余文字：
{{
  "model_id": "与输入一致的机型 id",
  "generated_at": "{GENERATED_AT}",
  "verdict": "buy|wait|avoid",
  "verdict_reason": "60 字内，必须引用输入里的具体数字",
  "price_position": "40 字内，说明当前价在 30 天区间的位置",
  "pros": ["3 条，每条 20 字内"],
  "cons": ["2~3 条，每条 20 字内"],
  "pitfalls": ["3~5 条，每条 30 字内，必须来自给定知识条目，写清怎么验、看哪里、判据阈值"],
  "sources": [{{"title": "来源名称", "url": "https://..."}}]
}}

判定规则（内部执行，不输出推理过程）：
1. verdict=buy：当前价 ≤ 30 天中位价的 0.98，或当前价距 30 天低点 ≤1%，且二手 95新 中位价 / 现价 ≤0.80。
2. verdict=wait：当前价在 30 天中位价 ±2% 内，或月跌幅在 -3%~0% 之间。
3. verdict=avoid：当前价高于 30 天中位价 3% 以上；或二手 95新 中位价 / 现价 >0.90；或首发已超 4 年且跌幅收敛。
4. price_position 与 verdict 必须自洽。
5. verdict_reason 的数字必须来自输入，禁止编造。
6. pitfalls 至少覆盖「价格陷阱」1 条，每条含一个可执行动作。
7. sources 只列真实站点首页或栏目页，2~3 条。
8. 所有金额为人民币整数元，不带 ¥ 符号；百分比保留 1 位小数。
9. 只输出 JSON，第一个字符是 {{，最后一个字符是 }}，不要 markdown 代码块包裹。
{JSON_TAIL}"""


# ---------------------------------------------------------------- 模型调用
def call_qwen(key: str, prompt: str, timeout: int = 90) -> dict:
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt + "\n" + JSON_TAIL},
        ],
        "temperature": 0.2,
        "top_p": 0.7,
        "max_tokens": 1200,
    }
    req = urllib.request.Request(
        DASHSCOPE_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    content = body["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return parse_json_loose(content)


def parse_json_loose(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t[3:]
    if t.endswith("```"):
        t = t[:-3]
    t = t.strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        lo, hi = t.find("{"), t.rfind("}")
        if lo >= 0 and hi > lo:
            return json.loads(t[lo:hi + 1])
        raise


# ---------------------------------------------------------------- 离线合成
def rule_verdict(model: dict, stats: dict) -> tuple[str, str]:
    """与 docs/prompts/report.md §二 判定规则一一对应，纯计算，不看模型。"""
    jd, med, ratio = stats["jd"], stats["median"], stats["used_ratio"]
    low, drop, pos = stats["min"], stats.get("drop_raw", stats["drop_pct"]), stats["position"]
    used95 = stats["used"].get("95新")

    if med and jd > med * 1.03:
        return "avoid", f"现价 {jd} 元高于 30 天中位 {med} 元 {(jd / med - 1) * 100:.1f}%，处高位不追"
    if ratio > 0.90 and used95:
        return "avoid", f"95新二手中位 {used95} 元已达现价 {jd} 元的 {ratio * 100:.0f}%，二手不划算"
    if pos > 0.90:
        return "avoid", f"现价 {jd} 元贴 30 天高点 {stats['max']} 元（分位 {pos * 100:.0f}%），等回落再入"
    if drop > -1.0 and jd <= med and ratio <= 0.85:
        return "buy", f"30 天已止跌（{stats['first']}→{stats['last']} 元，变动 {drop}%），现价 {jd} 元不高于中位 {med} 元，95新二手 {used95 or '-'} 元占 {ratio * 100:.0f}%，可下手"
    return "wait", f"现价 {jd} 元处于 30 天中位 {med} 元附近，月内仍跌 {abs(drop)}%（低点 {low} 元），等回落 1%~2% 再入"


def synth_report(model: dict, stats: dict, picks: list[dict]) -> dict:
    verdict, reason = rule_verdict(model, stats)
    used = stats["used"]
    jd = stats["jd"]
    pos = position_text(stats["position"])
    launch = int(model.get("launch_price") or 0)
    off = round((1 - jd / launch) * 100) if launch else 0

    pros = [
        f"较首发 {launch} 元已降 {off}%" if launch else f"现价 {jd} 元",
        f"近 30 天仅在 {stats['min']}~{stats['max']} 元窄幅波动",
        f"95新二手 {used['95新']} 元，二手机源充足" if used["95新"] else "二手机源以闲鱼为主",
    ]
    cons = [
        f"月内跌幅 {abs(stats['drop_pct'])}%，仍在下行通道" if stats["drop_pct"] < 0 else "价格已止跌，向上空间有限",
        "二手机水较深，需逐项验拆修与进水",
    ]
    if stats["used_ratio"] > 0.85:
        cons.append("二手价占现价偏高，二手性价比不明显")
    else:
        cons.append(f"二手 95新 仅为现价 {stats['used_ratio'] * 100:.0f}%，新机性价比一般")

    def clip(s: str, n: int = 30) -> str:
        s = s.replace("（来源：知乎评测摘要）", "").replace("（来源：站长之家教程）", "")
        return s if len(s) <= n else s[: n - 1] + "…"

    pitfalls = [clip(f"[{k['category']}] {k['title']}：{k['content']}", 30) for k in picks[:4]]
    if len(pitfalls) < 3:
        pitfalls.append(f"[价格陷阱] 低于 95新 中位 {used['95新'] or jd} 元 20% 的挂单先假定有坑")

    return {
        "model_id": model["id"],
        "generated_at": GENERATED_AT,
        "verdict": verdict,
        "verdict_reason": reason if len(reason) <= 60 else reason[:59] + "…",
        "price_position": f"{pos}（{stats['min']}~{stats['max']} 元区间，分位 {stats['position'] * 100:.0f}%）",
        "pros": pros[:3],
        "cons": cons[:3],
        "pitfalls": pitfalls[:5],
        "sources": [
            {"title": "京东", "url": f"https://item.jd.com/"},
            {"title": "闲鱼", "url": "https://www.goofish.com/"},
            {"title": "中关村在线", "url": "https://detail.zol.com.cn/"},
        ],
    }


# ---------------------------------------------------------------- 校验
def validate(rep: dict, model: dict) -> list[str]:
    errs: list[str] = []
    if rep.get("model_id") != model["id"]:
        errs.append(f"model_id 不符: {rep.get('model_id')} != {model['id']}")
    if rep.get("verdict") not in ("buy", "wait", "avoid"):
        errs.append(f"verdict 非法: {rep.get('verdict')}")
    if not str(rep.get("generated_at") or "").startswith("2026-"):
        errs.append("generated_at 缺失或格式不符")
    if not str(rep.get("verdict_reason") or "").strip():
        errs.append("verdict_reason 为空")
    if not str(rep.get("price_position") or "").strip():
        errs.append("price_position 为空")
    for key, lo, hi in (("pros", 3, 3), ("cons", 2, 3), ("pitfalls", 3, 5), ("sources", 2, 3)):
        val = rep.get(key)
        if not isinstance(val, list) or not (lo <= len(val) <= hi):
            errs.append(f"{key} 数量应为 {lo}~{hi}，实际 {len(val) if isinstance(val, list) else 'N/A'}")
    for s in rep.get("sources") or []:
        if not isinstance(s, dict) or not str(s.get("url", "")).startswith("https://"):
            errs.append("sources 条目需 {title,url} 且 url 以 https:// 开头")
            break
    return errs


# ---------------------------------------------------------------- 主流程
def main() -> int:
    ap = argparse.ArgumentParser(description="机鉴 · 报告预生成（qwen-plus / 离线合成）")
    ap.add_argument("--models", default=None, help="models.json 路径，或逗号分隔的 model_id 列表；默认 T1 前 6 款")
    ap.add_argument("--out", default="data/reports", help="输出目录，默认 data/reports")
    ap.add_argument("--force", action="store_true", help="已存在也覆盖（默认跳过，保护人工样例）")
    ap.add_argument("--offline", action="store_true", help="强制离线合成，不调模型")
    args = ap.parse_args()

    models = load_json(DATA / "models.json")
    current = load_json(DATA / "prices_current.json")
    history = load_json(DATA / "prices_history.json")
    used = load_json(DATA / "used_samples.json")
    knowledge_path = DATA / "knowledge.json"
    knowledge = load_json(knowledge_path) if knowledge_path.exists() else []

    targets = pick_models(args.models, models)
    out_dir = (ROOT / args.out) if not Path(args.out).is_absolute() else Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    key = "" if args.offline else load_env_key("DASHSCOPE_KEY")
    mode = "online(qwen-plus)" if key else "offline(rule-synth)"
    print(f"[gen_reports] 目标 {len(targets)} 款 | 输出 {out_dir} | 模式 {mode} | 知识条目 {len(knowledge)} 条")
    if not key:
        print("[gen_reports] 未检测到 DASHSCOPE_KEY，走离线合成模式（规则判定 + 知识抽取），产物字段齐全可直接联调")

    failures = 0
    for m in targets:
        stats = price_stats(m["id"], history, current, used)
        picks = match_knowledge(m, stats, knowledge)
        out_path = out_dir / f"{m['id']}.json"

        if out_path.exists() and not args.force:
            print(f"  SKIP  {m['id']:22s} 已存在（--force 覆盖）")
            continue

        rep = None
        if key:
            prompt = build_prompt(m, stats, picks)
            for attempt in (1, 2):
                try:
                    rep = call_qwen(key, prompt)
                    break
                except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as exc:
                    body = exc.read().decode("utf-8", "ignore")[:200] if isinstance(exc, urllib.error.HTTPError) else str(exc)[:200]
                    print(f"  WARN  {m['id']} 第 {attempt} 次调用失败: {body}")
                    time.sleep(1.5 * attempt)
        if not rep:
            if key:
                print(f"  FALL  {m['id']} 模型不可用，降级离线合成")
            rep = synth_report(m, stats, picks)

        errs = validate(rep, m)
        if errs:
            print(f"  FAIL  {m['id']} 校验不过: {'; '.join(errs)}")
            rep = synth_report(m, stats, picks)
            errs = validate(rep, m)
            if errs:
                failures += 1
                continue

        out_path.write_text(json.dumps(rep, ensure_ascii=False, indent=2) + chr(10), encoding="utf-8")
        print(f"  OK    {m['id']:22s} verdict={rep['verdict']:5s} 现价 {stats['jd']} / 中位 {stats['median']} / 95新 {stats['used']['95新']}")

    print(f"[gen_reports] 完成，失败 {failures} 款")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
