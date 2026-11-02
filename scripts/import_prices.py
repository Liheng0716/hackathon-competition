#!/usr/bin/env python3
"""scripts/import_prices.py —— 新机历史价 / 现价入库（P1 唯一入口，禁止手改 JSON）

用法：
    python scripts/import_prices.py prices_history.csv prices_current.csv

prices_history.csv 列：model_id,date,price          （一行=一机型一天）
prices_current.csv 列：model_id,jd_price,captured_at,source

行为：
  - 历史价按 model_id 聚合、日期升序去重（同日保留最后一次出现的值）
  - 与 data/prices_history.json 深合并，按日期去重保留最新
  - 现价更新 data/prices_current.json 对应机型 { jd, captured_at, source }
  - model_id 不在 data/models.json → 写入 skipped.csv；价格非正数 → skipped.csv
  - 原子写：tmp + os.replace，可重复执行（幂等）
"""
from __future__ import annotations

import csv
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CST = timezone(timedelta(hours=8))


def read_json(path: Path, default):
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def atomic_write_json(path: Path, payload) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.parent.mkdir(parents=True, exist_ok=True)
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        print(f"[warn] 找不到 {path}，跳过")
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        return [row for row in csv.DictReader(f)]


def is_positive_price(raw: str) -> bool:
    try:
        return float(raw) > 0
    except (TypeError, ValueError):
        return False


def main() -> int:
    history_csv = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "prices_history.csv"
    current_csv = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "prices_current.csv"

    models = read_json(DATA / "models.json", [])
    valid_ids = {m["id"] for m in models}
    print(f"[info] models.json 机型数 = {len(valid_ids)}")

    history = read_json(DATA / "prices_history.json", {})
    current = read_json(DATA / "prices_current.json", {})
    skipped: list[dict] = []

    # 1) 历史价
    by_model: dict[str, dict[str, int]] = {}
    for row in read_csv(history_csv):
        mid = (row.get("model_id") or "").strip()
        date = (row.get("date") or "").strip()
        price = (row.get("price") or "").strip()
        if mid not in valid_ids:
            skipped.append({**row, "reason": "unknown model_id"})
            continue
        if not date or not is_positive_price(price):
            skipped.append({**row, "reason": "bad date/price"})
            continue
        by_model.setdefault(mid, {})[date] = int(round(float(price)))

    for mid, days in by_model.items():
        merged = {p["date"]: int(p["price"]) for p in history.get(mid, [])}
        merged.update(days)  # CSV 覆盖旧值
        history[mid] = [{"date": d, "price": merged[d]} for d in sorted(merged)]
        print(f"[ok] history {mid}: {len(history[mid])} 天")

    # 2) 现价
    now = datetime.now(CST).replace(microsecond=0).isoformat()
    for row in read_csv(current_csv):
        mid = (row.get("model_id") or "").strip()
        price = (row.get("jd_price") or row.get("price") or "").strip()
        if mid not in valid_ids or not is_positive_price(price):
            skipped.append({**row, "reason": "unknown model_id or bad price"})
            continue
        current[mid] = {
            "jd": int(round(float(price))),
            "captured_at": (row.get("captured_at") or now).strip() or now,
            "source": (row.get("source") or "manual").strip() or "manual",
        }
        print(f"[ok] current {mid}: {current[mid]['jd']} ({current[mid]['source']})")

    atomic_write_json(DATA / "prices_history.json", history)
    atomic_write_json(DATA / "prices_current.json", current)

    if skipped:
        out = ROOT / "skipped.csv"
        with out.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=sorted({k for r in skipped for k in r}))
            writer.writeheader()
            writer.writerows(skipped)
        print(f"[warn] {len(skipped)} 行跳过，详见 {out}")

    print("[done] prices_history.json / prices_current.json 已原子更新")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
