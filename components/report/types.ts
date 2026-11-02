// 报告数据 schema —— 与 docs/README-dev.md「数据与 API 契约」一致：
// { model_id, generated_at, verdict, verdict_reason, price_position, pros[], cons[], pitfalls[], sources[{title,url}] }

export type Verdict = "buy" | "wait" | "avoid";

/** price_position 由泳道3 生成，形态未完全固定：兼容 数字 / 字符串 / 对象 */
export type PricePosition =
  | number
  | string
  | {
      percentile?: number;
      current?: number;
      low?: number;
      high?: number;
      median?: number;
      label?: string;
    };

/** pitfalls（翻车案例）：兼容 字符串 或 {title, detail} 两种写法 */
export type Pitfall = string | { title?: string; detail?: string };

export interface ReportSource {
  title: string;
  url: string;
}

export interface ReportData {
  model_id: string;
  generated_at: string;
  verdict: Verdict;
  verdict_reason: string;
  price_position: PricePosition;
  pros: string[];
  cons: string[];
  pitfalls: Pitfall[];
  sources: ReportSource[];
  // 以下为可选扩展字段（非契约必需，缺失时前端降级展示）
  model_name?: string;
  current_price?: number;
}

export interface NormalizedPricePosition {
  /** 历史百分位 0-100，缺失为 null（越低越便宜） */
  percentile: number | null;
  current?: number;
  low?: number;
  high?: number;
  label?: string;
}

export function normalizePricePosition(
  p: PricePosition | undefined,
): NormalizedPricePosition {
  if (p == null) return { percentile: null };
  if (typeof p === "number") return { percentile: p };
  if (typeof p === "string") return { percentile: null, label: p };
  return {
    percentile:
      typeof p.percentile === "number" ? p.percentile : null,
    current: p.current,
    low: p.low,
    high: p.high,
    label: p.label,
  };
}

export function pitfallText(p: Pitfall): { title: string; detail: string } {
  if (typeof p === "string") return { title: p, detail: "" };
  return { title: p.title ?? "", detail: p.detail ?? "" };
}

export const VERDICT_STYLE: Record<
  Verdict,
  { label: string; badge: string; ring: string }
> = {
  buy: {
    label: "值得买",
    badge: "bg-green-100 text-green-700 border-green-300",
    ring: "border-green-400 bg-green-50",
  },
  wait: {
    label: "等降价",
    badge: "bg-amber-100 text-amber-700 border-amber-300",
    ring: "border-amber-400 bg-amber-50",
  },
  avoid: {
    label: "别买",
    badge: "bg-red-100 text-red-700 border-red-300",
    ring: "border-red-400 bg-red-50",
  },
};

export function verdictStyle(v: string) {
  return VERDICT_STYLE[v as Verdict] ?? VERDICT_STYLE.wait;
}

/** 由生成时间计算「更新于 x 小时前」，>48h 标黄 */
export function dataAge(generatedAt: string): {
  text: string;
  stale: boolean;
} {
  const t = new Date(generatedAt).getTime();
  if (Number.isNaN(t)) return { text: "数据时间未知", stale: true };
  const hours = (Date.now() - t) / 36e5;
  const stale = hours > 48;
  if (hours < 1) return { text: "刚刚更新", stale };
  if (hours < 24) return { text: `更新于 ${Math.floor(hours)} 小时前`, stale };
  return { text: `更新于 ${Math.floor(hours / 24)} 天前`, stale };
}
