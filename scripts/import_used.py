#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/import_used.py —— 二手样本入库：CSV → 五档归一 → data/used_samples.json 追加

列必须为：platform,model_id,title,price,condition_text,link,captured_at

行为：
  1. 每 --batch 条（默认 20）一批，调 DashScope OpenAI 兼容口 qwen-plus 把
     condition_text 归一到五档（99新/95新/9成新/8成新/大修或功能缺陷）；
  2. 没有 DASHSCOPE_KEY 或加 --no-llm 时，自动降级为关键词规则归一（保证离线能跑）；
  3. 归一失败的行（价格非法、model_id 不在 models.json、缺 title 等）写 --failed（默认 failed.csv）；
  4. 结果按 platform+model_id+link（无 link 用 platform+model_id+title+captured_at）去重后写回 JSON。

环境变量：
  DASHSCOPE_KEY       有则用 LLM，没有走规则
  DASHSCOPE_BASE_URL  默认 https://dashscope.aliyuncs.com/compatible-mode/v1
  QWEN_TEXT_MODEL     默认 qwen-plus

示例：
  python scripts/import_used.py samples.csv
  python scripts/import_used.py samples.csv --no-llm --dry-run
  python scripts/import_used.py samples.csv --out data/used_samples.json --failed out/failed.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Windows 控制台默认 cp1252/gbk，中文 print 会 UnicodeEncodeError，统一改 UTF-8
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):
        pass

COLUMNS = ["platform", "model_id", "title", "price", "condition_text", "link", "captured_at"]
GRADES = ["99新", "95新", "9成新", "8成新", "大修或功能缺陷"]

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODELS = ROOT / "data" / "models.json"
DEFAULT_OUT = ROOT / "data" / "used_samples.json"
DEFAULT_FAILED = ROOT / "failed.csv"

FENCE = chr(96) * 3  # 三反引号，避免本文件自身被 markdown 解析

# ---------------------------------------------------------------- 关键词规则

# 「无拆修 / 未进水」这类否定短语先删掉，避免被大修关键词误伤
NEGATIONS = [
    "无拆修", "未拆修", "没拆修", "无维修", "未维修", "没维修", "无修", "没修过",
    "无进水", "未进水", "没进水", "无泡水", "未泡水", "没有进水",
]

SEVERE_WORDS = [
    "大修", "进水", "泡水", "换屏", "换主板", "主板", "维修", "修过", "不开机",
    "无法开机", "功能缺陷", "死机", "黑屏", "漏液", "拆修", "有故障", "故障", "报废",
]

RULES: List[Tuple[str, List[str]]] = [
    ("99新", ["99新", "99成新", "全新", "未拆封", "仅拆封", "仅拆", "拆封", "无使用痕迹", "准全新", "几乎全新", "未使用"]),
    ("95新", ["95新", "95成新", "9.5成新", "准新", "轻微使用痕迹", "细微划痕", "轻微细划"]),
    ("9成新", ["9成新", "九成新", "9成", "九成", "轻微划痕", "小磕碰", "轻微磕碰", "轻度划痕"]),
    ("8成新", ["8成新", "八成新", "8成", "八成", "明显划痕", "多处划痕", "磕碰", "掉漆", "磨损", "掉肉"]),
]


def rule_grade(condition_text: str) -> Tuple[str, str]:
    """关键词规则归一，返回 (档位, 命中的关键词)"""
    text = (condition_text or "").lower()
    cleaned = text
    for neg in NEGATIONS:
        cleaned = cleaned.replace(neg, "")
    for w in SEVERE_WORDS:
        if w in cleaned:
            return "大修或功能缺陷", w
    for grade, words in RULES:
        for w in words:
            if w.lower() in text:
                return grade, w
    return "95新", "默认(无明显线索)"


# ---------------------------------------------------------------- LLM 归一

SYSTEM_PROMPT = """你是二手数码样本的成色标注员。把卖家写的成色描述归一到唯一五档之一：
- 99新：无使用痕迹，可能仅拆封
- 95新：轻微使用痕迹，无划痕磕碰
- 9成新：明显轻划痕或小磕碰
- 8成新：多处划痕磕碰、掉漆
- 大修或功能缺陷：拆修、换过件、进水、不开机、功能异常
判定优先级：出现拆修/进水/功能问题的，一律「大修或功能缺陷」，不管前面写了什么成色。
注意否定语：「无拆修」「未进水」「无磕碰」是正面信号，不能因此判大修。
只输出 JSON，不要任何多余文字。"""

USER_TEMPLATE = """把下面每一条的 condition_text 归一到五档，输出 JSON 数组，元素形如 {"i": 序号, "grade": "五档之一", "confidence": 0-1 的小数}，条数必须与输入一致，不要漏项。
输入：
{rows}"""


def llm_normalize(batch: List[Dict[str, Any]], model: str, base_url: str, key: str,
                  timeout: int = 60) -> Optional[List[str]]:
    """一批调一次 LLM，返回与 batch 等长的档位列表；失败返回 None"""
    rows = [
        {"i": i, "title": r.get("title", "")[:80], "condition_text": (r.get("condition_text") or "")[:100]}
        for i, r in enumerate(batch)
    ]
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_TEMPLATE.format(rows=json.dumps(rows, ensure_ascii=False))},
        ],
        "temperature": 0,
        "max_tokens": 1500,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        base_url.rstrip("/") + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json", "authorization": "Bearer " + key},
        method="POST",
    )
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            text = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
            items = parse_loose(text)
            if items is None:
                raise ValueError("LLM 返回非 JSON: " + text[:200])
            aligned = align_grades(items, len(batch))
            if aligned is None:
                raise ValueError("LLM 结果对齐失败")
            return aligned
        except Exception as exc:  # noqa: BLE001 —— 单批失败只影响这一批
            print(f"  ! 第 {attempt + 1} 次调用失败：{exc}", file=sys.stderr)
            time.sleep(1 + attempt)
    return None


def parse_loose(text: str) -> Optional[List[Any]]:
    """剥围栏包裹、截取第一个 [ 或 { 到最后一个 ] 或 }"""
    s = (text or "").strip()
    fence = re.search(FENCE + r"(?:json)?\s*([\s\S]*?)" + FENCE, s, flags=re.I)
    if fence:
        s = fence.group(1).strip()
    starts = [i for i in (s.find("["), s.find("{")) if i >= 0]
    if not starts:
        return None
    start = min(starts)
    end = max(s.rfind("]"), s.rfind("}"))
    if end <= start:
        return None
    try:
        data = json.loads(s[start:end + 1])
    except json.JSONDecodeError:
        return None
    if isinstance(data, dict):
        for key in ("items", "results", "data", "grades", "rows"):
            if isinstance(data.get(key), list):
                return data[key]
        return None
    return data if isinstance(data, list) else None


def align_grades(items: List[Any], n: int) -> Optional[List[str]]:
    """把 LLM 结果按 i 对回批次位置，缺失项留 None（外层再走规则兜底）"""
    out: List[Optional[str]] = [None] * n
    for pos, item in enumerate(items):
        if isinstance(item, dict):
            idx = item.get("i", item.get("index", pos))
            grade = item.get("grade", item.get("成色"))
        else:
            idx, grade = pos, item
        try:
            idx = int(idx)
        except (TypeError, ValueError):
            idx = pos
        if 0 <= idx < n:
            g = str(grade or "").strip()
            out[idx] = g if g in GRADES else None
    if all(g is None for g in out):
        return None
    return [g if g in GRADES else "" for g in out]  # type: ignore[list-item]


# ---------------------------------------------------------------- IO


def read_models(path: Path) -> set:
    try:
        items = json.loads(path.read_text(encoding="utf-8"))
        return {str(x.get("id")) for x in items if isinstance(x, dict)}
    except Exception as exc:  # noqa: BLE001
        print(f"! 读 models.json 失败（{exc}），跳过 model_id 校验", file=sys.stderr)
        return set()


def coerce_price(v: Any) -> Optional[int]:
    if v is None:
        return None
    s = re.sub(r"[^\d.]", "", str(v))
    if not s:
        return None
    try:
        n = float(s)
    except ValueError:
        return None
    if n <= 0 or n > 200000:
        return None
    return int(round(n))


def load_existing(out_path: Path) -> List[Dict[str, Any]]:
    if not out_path.exists():
        return []
    try:
        data = json.loads(out_path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception as exc:  # noqa: BLE001
        print(f"! 现有 {out_path} 解析失败（{exc}），按空文件处理", file=sys.stderr)
        return []


def dedupe_key(row: Dict[str, Any]) -> Tuple[str, ...]:
    if row.get("link"):
        return ("link", str(row.get("platform", "")), str(row.get("model_id", "")), str(row["link"]))
    return (
        "title",
        str(row.get("platform", "")),
        str(row.get("model_id", "")),
        str(row.get("title", "")),
        str(row.get("captured_at", "")),
    )


def write_json_atomic(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp" + str(os.getpid()))
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def read_csv(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit("CSV 缺列：" + ", ".join(missing) + "；需要 " + ",".join(COLUMNS))
        for lineno, raw in enumerate(reader, start=2):
            row = {c: (raw.get(c) or "").strip() for c in COLUMNS}
            if not any(row.values()):
                continue
            row["_line"] = str(lineno)
            rows.append(row)
    return rows


# ---------------------------------------------------------------- 主流程


def main(argv: Optional[Iterable[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="二手样本 CSV → 五档归一 → used_samples.json 追加")
    ap.add_argument("csv_path", help="输入 CSV（列：platform,model_id,title,price,condition_text,link,captured_at）")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="输出 JSON（默认 data/used_samples.json，追加写）")
    ap.add_argument("--failed", default=str(DEFAULT_FAILED), help="失败行落盘（默认 failed.csv）")
    ap.add_argument("--models", default=str(DEFAULT_MODELS), help="机型目录，用于校验 model_id")
    ap.add_argument("--batch", type=int, default=20, help="每批条数（默认 20）")
    ap.add_argument("--model", default=os.environ.get("QWEN_TEXT_MODEL", "qwen-plus"), help="LLM 模型名")
    ap.add_argument("--no-llm", "--rule-only", dest="no_llm", action="store_true", help="强制只走关键词规则")
    ap.add_argument("--allow-unknown-model", action="store_true", help="model_id 不在 models.json 也收")
    ap.add_argument("--no-dedupe", action="store_true", help="不去重直接追加")
    ap.add_argument("--dry-run", action="store_true", help="只打印统计，不写文件")
    args = ap.parse_args(list(argv) if argv is not None else None)

    csv_path = Path(args.csv_path).expanduser()
    if not csv_path.exists():
        raise SystemExit(f"找不到 CSV：{csv_path}")

    out_path = Path(args.out).expanduser()
    failed_path = Path(args.failed).expanduser()
    models = read_models(Path(args.models).expanduser())

    rows = read_csv(csv_path)
    print(f"读入 {len(rows)} 行，模型 {args.model}，批大小 {args.batch}")

    key = os.environ.get("DASHSCOPE_KEY", "").strip()
    base_url = os.environ.get("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1").strip()
    use_llm = bool(key) and not args.no_llm
    if not use_llm:
        print("无 DASHSCOPE_KEY（或已指定 --no-llm），降级为关键词规则归一")

    # 1) 结构性校验
    good: List[Dict[str, Any]] = []
    failed: List[Dict[str, Any]] = []
    for row in rows:
        price = coerce_price(row.get("price"))
        reason = ""
        if not row.get("model_id"):
            reason = "缺 model_id"
        elif models and row["model_id"] not in models and not args.allow_unknown_model:
            reason = "model_id 不在 models.json"
        elif price is None:
            reason = "price 非法或超范围"
        elif not row.get("title"):
            reason = "缺 title"
        if reason:
            failed.append({**row, "reason": reason})
            continue
        row["price"] = price
        good.append(row)

    # 2) 分批归一
    grades: List[Optional[str]] = [None] * len(good)
    llm_hits = 0
    size = max(1, args.batch)
    batches = [good[i:i + size] for i in range(0, len(good), size)]
    for bi, batch in enumerate(batches, start=1):
        result: Optional[List[str]] = None
        if use_llm:
            print(f"  批 {bi}/{len(batches)}：{len(batch)} 条 → LLM")
            result = llm_normalize(batch, args.model, base_url, key)
        offset = (bi - 1) * size
        for j, row in enumerate(batch):
            g = result[j] if result and j < len(result) and result[j] in GRADES else None
            if g:
                grades[offset + j] = g
                llm_hits += 1
            else:
                rgrade, hit = rule_grade(row.get("condition_text", ""))
                grades[offset + j] = rgrade
                if use_llm:
                    print(f"    · 第 {row['_line']} 行 LLM 未给出，规则兜底 → {rgrade}（{hit}）")

    # 3) 组装 + 去重
    existing = load_existing(out_path)
    seen = set() if args.no_dedupe else {dedupe_key(r) for r in existing if isinstance(r, dict)}
    added: List[Dict[str, Any]] = []
    for row, grade in zip(good, grades):
        if grade not in GRADES:
            failed.append({**row, "reason": "档位归一失败"})
            continue
        rec = {
            "platform": row.get("platform") or "xianyu",
            "model_id": row["model_id"],
            "title": row["title"],
            "price": row["price"],
            "condition_text": row.get("condition_text", ""),
            "grade": grade,
            "link": row.get("link", ""),
            "captured_at": row.get("captured_at", ""),
        }
        k = dedupe_key(rec)
        if k in seen:
            continue
        seen.add(k)
        added.append(rec)

    # 4) 落盘
    merged = existing + added
    if args.dry_run:
        print(f"[dry-run] 可入库 {len(added)} 条，失败 {len(failed)} 条，合并后 {len(merged)} 条，未写文件")
    else:
        write_json_atomic(out_path, merged)
        print(f"写入 {out_path}：新增 {len(added)} 条，合并后 {len(merged)} 条")

    if failed:
        failed_path.parent.mkdir(parents=True, exist_ok=True)
        with failed_path.open("w", encoding="utf-8-sig", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=COLUMNS + ["reason"], extrasaction="ignore")
            writer.writeheader()
            writer.writerows(failed)
        print(f"失败 {len(failed)} 行 → {failed_path}")

    # 5) 汇总
    stat: Dict[str, int] = {}
    for rec in added:
        stat[rec["grade"]] = stat.get(rec["grade"], 0) + 1
    print("入库档位分布：" + "、".join(f"{g} {stat.get(g, 0)}" for g in GRADES))
    print(f"LLM 命中 {llm_hits} 条，规则/兜底 {len(good) - llm_hits} 条")
    return 0


if __name__ == "__main__":
    sys.exit(main())
