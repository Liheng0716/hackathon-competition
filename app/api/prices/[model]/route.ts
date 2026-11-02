// GET /api/prices/[model] —— 聚合 prices_current + prices_history + used_samples（泳道2）
import { findModel, medianByGradeOf, readPricesCurrent, readPricesHistory, readUsedSamples } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(_req: Request, { params }: { params: { model: string } }): Promise<Response> {
  const id = decodeURIComponent(params.model || "").trim();
  const model = findModel(id);
  if (!model) return json({ error: "机型不存在", model_id: id }, 404);

  const current = readPricesCurrent()[id] ?? null;
  const history = readPricesHistory()[id];
  const samples = readUsedSamples().filter((s) => s.model_id === id);
  const median_by_grade = medianByGradeOf(samples);

  const body: Record<string, unknown> = {
    model: {
      id: model.id,
      brand: model.brand,
      name: model.name,
      variant: model.variant,
      tier: model.tier,
    },
    current,
    history: Array.isArray(history) ? history : undefined,
    used:
      samples.length > 0
        ? {
            samples,
            median_by_grade,
            count: samples.length,
            platforms: Array.from(new Set(samples.map((s) => s.platform))).filter(Boolean),
          }
        : undefined,
  };

  // 新机价相对历史均价的偏离，前端可直出「低于均价 x%」
  if (current && Array.isArray(history) && history.length >= 2) {
    const prices = history.map((h) => Number(h.price)).filter((n) => Number.isFinite(n) && n > 0);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    body.history_stats = {
      days: history.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Math.round(avg),
      latest: prices[prices.length - 1],
      vs_avg_pct: Number((((Number(current.jd) - avg) / avg) * 100).toFixed(1)),
    };
  }

  return json(body);
}
