// lib/data.ts —— data/ 目录 JSON 读写层（泳道2）
// 读：内存缓存 + mtime/size 失效，文件被外部改动（seed/脚本）时自动重读
// 写：同目录写临时文件 → renameSync 原子替换，避免并发读到半截 JSON
import fs from "node:fs";
import path from "node:path";
import type { Grade } from "@/lib/estimate";
import { GRADES, normalizeGrade, median } from "@/lib/estimate";

export const DATA_ROOT = path.join(process.cwd(), "data");

export type Model = {
  id: string;
  brand: string;
  name: string;
  variant: string;
  tier: number;
  launch_price: number;
  jd_url: string;
  keywords_xianyu: string;
};

export type CurrentPrice = {
  jd: number;
  captured_at: string;
  source: string;
};

export type PricePoint = {
  date: string;
  price: number;
};

export type UsedSample = {
  platform: string;
  model_id: string;
  title: string;
  price: number;
  condition_text: string;
  grade: Grade;
  link: string;
  captured_at: string;
};

export type KnowledgeItem = {
  id: string;
  category: string;
  title: string;
  content: string;
  source: string;
};

export type Report = {
  model_id: string;
  verdict: string;
  verdict_reason: string;
  price_position: string;
  pros: string[];
  cons: string[];
  pitfalls: string[];
  sources: string[];
  generated_at?: string;
};

type CacheEntry = { stamp: string; value: unknown };
const cache = new Map<string, CacheEntry>();

/** 把相对路径解析进 data/，任何越界（..、绝对路径）直接抛错 */
export function resolveDataPath(relPath: string): string {
  if (typeof relPath !== "string" || !relPath.trim()) throw new Error("readJson: 路径为空");
  if (path.isAbsolute(relPath)) throw new Error(`readJson: 不允许绝对路径 ${relPath}`);
  const full = path.resolve(DATA_ROOT, relPath);
  const rootWithSep = DATA_ROOT.endsWith(path.sep) ? DATA_ROOT : DATA_ROOT + path.sep;
  if (full !== DATA_ROOT && !full.startsWith(rootWithSep)) throw new Error(`readJson: 路径越界 ${relPath}`);
  return full;
}

function stampOf(full: string): string | null {
  try {
    const st = fs.statSync(full);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return null;
  }
}

/**
 * 读 data/ 下的 JSON。
 * 文件不存在或解析失败时：给了 fallback 就用 fallback，没给就抛错。
 */
export function readJson<T>(relPath: string, fallback?: T): T {
  const full = resolveDataPath(relPath);
  const stamp = stampOf(full);
  if (stamp === null) {
    cache.delete(full);
    if (fallback !== undefined) return fallback;
    throw new Error(`数据文件不存在: ${relPath}`);
  }
  const hit = cache.get(full);
  if (hit && hit.stamp === stamp) return hit.value as T;

  const text = fs.readFileSync(full, "utf8");
  let value: T;
  try {
    value = (text.trim() ? JSON.parse(text) : fallback) as T;
  } catch (e) {
    cache.delete(full);
    if (fallback !== undefined) return fallback;
    throw new Error(`JSON 解析失败: ${relPath} (${(e as Error).message})`);
  }
  if (value === undefined && fallback !== undefined) value = fallback;
  cache.set(full, { stamp, value });
  return value;
}

/** 原子写：临时文件 + renameSync（同目录，跨盘不会失败） */
export function writeJson<T>(relPath: string, data: T, opts: { spaces?: number } = {}): string {
  const full = resolveDataPath(relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const tmp = `${full}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  const text = JSON.stringify(data, null, opts.spaces ?? 2) + "\n";
  try {
    fs.writeFileSync(tmp, text, "utf8");
    fs.renameSync(tmp, full);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* 临时文件已不存在 */
    }
    throw e;
  }
  cache.set(full, { stamp: stampOf(full) ?? "", value: data });
  return full;
}

/** 手动失效（测试用） */
export function clearCache(): void {
  cache.clear();
}

/* ------------------------------ 业务读取 ------------------------------ */

export function readModels(): Model[] {
  return readJson<Model[]>("models.json", []);
}

export function findModel(id: string): Model | undefined {
  if (!id) return undefined;
  return readModels().find((m) => m.id === id);
}

export function readPricesCurrent(): Record<string, CurrentPrice> {
  return readJson<Record<string, CurrentPrice>>("prices_current.json", {});
}

export function readPricesHistory(): Record<string, PricePoint[]> {
  return readJson<Record<string, PricePoint[]>>("prices_history.json", {});
}

export function readUsedSamples(): UsedSample[] {
  return readJson<UsedSample[]>("used_samples.json", []);
}

export function readKnowledge(): KnowledgeItem[] {
  return readJson<KnowledgeItem[]>("knowledge.json", []);
}

/** reports 目录里没有就返回 null（不抛错，GET 用） */
export function readReport(id: string): Report | null {
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  try {
    return readJson<Report>(`reports/${id}.json`);
  } catch {
    return null;
  }
}

export function writeReport(report: Report): string {
  return writeJson(`reports/${report.model_id}.json`, report);
}

/** 某机型的二手样本 */
export function usedSamplesOf(modelId: string): UsedSample[] {
  return readUsedSamples().filter((s) => s.model_id === modelId);
}

/** 五档中位价（键固定五档，无样本为 null） */
export function medianByGradeOf(samples: UsedSample[]): Record<Grade, number | null> {
  const buckets: Record<string, number[]> = {};
  for (const s of samples) {
    const g = normalizeGrade(s.grade);
    const p = Number(s.price);
    if (!g || !Number.isFinite(p) || p <= 0) continue;
    (buckets[g] ||= []).push(p);
  }
  const out = {} as Record<Grade, number | null>;
  for (const g of GRADES) {
    const m = median(buckets[g] || []);
    out[g] = m === null ? null : Math.round(m);
  }
  return out;
}
