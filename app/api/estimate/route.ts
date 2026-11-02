// POST /api/estimate —— 二手估价（泳道2）
// body: { model_id, grade?, answers?: { screen_scratches, frame_dents, repaired, water, box_accessories } }
// 返回: { low, mid, high, basis[] } + 计算过程字段（grade/coef/base95/sample_count/confidence）
import { deriveGrade, computeEstimate, GRADE_COEF, GRADES, FIX_COEF, RANGE_LOW, RANGE_HIGH, normalizeGrade } from "@/lib/estimate";
import type { Answers } from "@/lib/estimate";
import { findModel, readPricesCurrent, usedSamplesOf } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** GET 返回系数表本身，方便调试与答辩讲口径 */
export async function GET(): Promise<Response> {
  return json({
    grades: GRADES,
    coef: GRADE_COEF,
    base_grade: "95新",
    fixes: FIX_COEF,
    range: { low: RANGE_LOW, high: RANGE_HIGH },
    notes: "目标价 = 95新基准价 × coef(grade) / coef(95新)，再乘 answers 修正项；区间为中位价 ±8%，四舍五入到十位。",
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求体不是合法 JSON" }, 400);
  }

  const model_id = typeof body?.model_id === "string" ? body.model_id.trim() : "";
  if (!model_id) return json({ error: "缺少 model_id" }, 400);

  const model = findModel(model_id);
  if (!model) return json({ error: "机型不存在", model_id }, 404);

  const answers: Answers | null = body?.answers && typeof body.answers === "object" ? body.answers : null;
  const grade = normalizeGrade(body?.grade) ?? (answers ? deriveGrade(answers) : "95新");

  const samples = usedSamplesOf(model_id);
  const newPrice = Number(readPricesCurrent()[model_id]?.jd);

  const result = computeEstimate({
    grade,
    answers,
    samples,
    new_price: Number.isFinite(newPrice) && newPrice > 0 ? newPrice : null,
    model_name: model.name,
    model_label: `${model.name} ${model.variant}`.trim(),
  });

  return json({
    model_id,
    model_label: `${model.name} ${model.variant}`.trim(),
    ...result,
  });
}
