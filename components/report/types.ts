// 报告 JSON 契约 —— 与任务书一致，字段不得改名
export type Verdict = "buy" | "wait" | "avoid";

export type ReportSource = { title: string; url: string };

export type Report = {
  model_id: string;
  generated_at?: string;
  verdict: Verdict | string;
  verdict_reason: string;
  price_position: string;
  pros: string[];
  cons: string[];
  pitfalls: string[];
  sources: ReportSource[];
};

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : x && typeof x === "object" ? String((x as any).title ?? "") : ""))
    .filter((x) => x.length > 0);
}

function sources(v: unknown): ReportSource[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const url = typeof o.url === "string" ? o.url : "";
      const title = typeof o.title === "string" && o.title ? o.title : url;
      return { title, url };
    })
    .filter((s) => s.url.length > 0);
}

/** 宽容读取：字段缺失补默认值，整体不成形返回 null */
export function normalizeReport(raw: unknown): Report | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const verdict = typeof o.verdict === "string" ? o.verdict : "";
  const reason = typeof o.verdict_reason === "string" ? o.verdict_reason : "";
  if (!verdict && !reason) return null;
  return {
    model_id: typeof o.model_id === "string" ? o.model_id : "",
    generated_at: typeof o.generated_at === "string" ? o.generated_at : undefined,
    verdict: verdict || "wait",
    verdict_reason: reason || "报告字段缺失，结论待复核",
    price_position: typeof o.price_position === "string" ? o.price_position : "暂无价格位置数据",
    pros: strArray(o.pros),
    cons: strArray(o.cons),
    pitfalls: strArray(o.pitfalls),
    sources: sources(o.sources),
  };
}
