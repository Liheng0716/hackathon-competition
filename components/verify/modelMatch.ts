// 把识机返回的 model_guess 对齐到 models.json 的 model_id（用于跳报告页）
import modelsJson from "@/data/models.json";

export const FALLBACK_MODEL_ID = "iphone-13-128g";

type ModelRow = { id: string; brand: string; name: string; variant: string; tier: number };

const MODELS = modelsJson as ModelRow[];

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[\s\-_/]+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/苹果/g, "iphone")
    .replace(/华为/g, "huawei")
    .replace(/小米/g, "xiaomi")
    .replace(/红米/g, "redmi");
}

export type ModelMatch = { id: string; matched: boolean; label: string };

export function guessModelSlug(guess?: string): ModelMatch {
  const g = norm(guess ?? "");
  if (!g) {
    return { id: FALLBACK_MODEL_ID, matched: false, label: "未识别到机型，按 iPhone 13 128G 兜底" };
  }

  let best: { row: ModelRow; score: number } | null = null;

  for (const row of MODELS) {
    const keys = [norm(row.name), norm(row.name + row.variant), norm(row.variant)];
    for (const key of keys) {
      if (!key || key.length < 3) continue;
      let score = 0;
      if (g === key) score = 100 + key.length;
      else if (g.includes(key)) score = 60 + key.length;
      else if (key.includes(g) && g.length >= 4) score = 40 + g.length;
      if (score > 0) score += row.tier === 1 ? 5 : 0;
      if (score > (best?.score ?? 0)) best = { row, score };
    }
  }

  if (!best) {
    return { id: FALLBACK_MODEL_ID, matched: false, label: "未识别到机型，按 iPhone 13 128G 兜底" };
  }

  const row = best.row;
  return {
    id: row.id,
    matched: true,
    label: `匹配机型：${row.name} ${row.variant}`,
  };
}
