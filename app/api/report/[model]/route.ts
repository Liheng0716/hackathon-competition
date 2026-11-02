// GET  /api/report/[model] —— 读 data/reports/<id>.json 缓存；没有则 404 { error: "报告生成中" }
// POST /api/report/[model] —— aiChat(deep=true) 生成报告并落盘；body 可带 { evaluations, force }
import { aiChat, parseJsonLoose } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai";
import type { Report } from "@/lib/data";
import {
  findModel,
  medianByGradeOf,
  readKnowledge,
  readPricesCurrent,
  readPricesHistory,
  readReport,
  usedSamplesOf,
  writeReport,
} from "@/lib/data";
import { GRADES } from "@/lib/estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

const VERDICTS = ["值得买", "谨慎入手", "别买"] as const;

function pickVerdict(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "谨慎入手";
  if (s.includes("别买") || s.includes("不值得") || s.includes("避雷") || s.includes("劝退")) return "别买";
  if (s.includes("谨慎") || s.includes("观望") || s.includes("再等等") || s.includes("中")) return "谨慎入手";
  if (s.includes("值得") || s.includes("推荐") || s.includes("买")) return "值得买";
  return VERDICTS.includes(s as any) ? s : "谨慎入手";
}

function strArr(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : String((x as any)?.text ?? x ?? "").trim()))
    .filter(Boolean)
    .slice(0, max);
}

function yuan(n: number | null | undefined): string {
  return n == null ? "无数据" : "¥" + Math.round(n).toLocaleString("zh-CN");
}

export async function GET(_req: Request, { params }: { params: { model: string } }): Promise<Response> {
  const id = decodeURIComponent(params.model || "").trim();
  const model = findModel(id);
  if (!model) return json({ error: "机型不存在", model_id: id }, 404);

  const cached = readReport(id);
  if (!cached) return json({ error: "报告生成中", model_id: id }, 404);
  return json({ ...cached, cached: true });
}

export async function POST(req: Request, { params }: { params: { model: string } }): Promise<Response> {
  const id = decodeURIComponent(params.model || "").trim();
  const model = findModel(id);
  if (!model) return json({ error: "机型不存在", model_id: id }, 404);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const force = body?.force === true;
  const evaluations =
    typeof body?.evaluations === "string"
      ? body.evaluations
      : Array.isArray(body?.evaluations)
        ? body.evaluations.map((x: unknown) => String(x)).join("\n")
        : typeof body?.text === "string"
          ? body.text
          : "";

  // 已有缓存且与未要求重生成且没有新评测语料 → 直接返回，省 AI 调用
  const cached = readReport(id);
  if (cached && !force && !evaluations) return json({ ...cached, cached: true });

  const label = `${model.name} ${model.variant}`.trim();
  const current = readPricesCurrent()[id] ?? null;
  const history = readPricesHistory()[id] || [];
  const samples = usedSamplesOf(id);
  const medians = medianByGradeOf(samples);

  const prices = history.map((h) => Number(h.price)).filter((n) => Number.isFinite(n) && n > 0);
  const histLine = prices.length
    ? `近 ${prices.length} 天：最低 ${yuan(Math.min(...prices))}、最高 ${yuan(Math.max(...prices))}、最新 ${yuan(prices[prices.length - 1])}、均价 ${yuan(prices.reduce((a, b) => a + b, 0) / prices.length)}`
    : "无历史价数据";

  const medianLine = GRADES.map((g) => `${g} ${yuan(medians[g])}`).join("、");
  const sampleTitles = samples
    .slice(0, 8)
    .map((s) => `${s.title}（${yuan(s.price)}/${s.grade}）`)
    .join("；");

  const knowledge = readKnowledge()
    .filter((k) => {
      const blob = `${k.title} ${k.content}`.toLowerCase();
      return blob.includes(model.name.toLowerCase()) || blob.includes(String(model.brand).toLowerCase()) || !k.title;
    })
    .slice(0, 8);
  const knowledgeLine = knowledge.length
    ? knowledge.map((k) => `- 【${k.category}】${k.title}：${k.content}`).join("\n")
    : "（knowledge.json 暂无匹配条目）";

  const system: ChatMessage = {
    role: "system",
    content:
      "你是二手数码行情分析师，用中文写购买决策报告。结论必须由数据支撑，禁止编造不存在的型号与价格。只输出 JSON，不要任何多余文字。",
  };

  const user: ChatMessage = {
    role: "user",
    content: `为「${label}」（品牌 ${model.brand}，机型 id ${model.id}，首发价 ${yuan(model.launch_price)}）写一页购买决策报告。
本地数据：
- 京东当前价：${current ? yuan(current.jd) + "（" + current.captured_at + " 抓取）" : "无数据"}
- 历史价：${histLine}
- 二手样本 ${samples.length} 条，五档中位价：${medianLine}
- 样本标题摘录：${sampleTitles || "无"}
- 避坑知识：
${knowledgeLine}
- 用户提供的评测/反馈：${evaluations || "（无）"}

输出 JSON，字段固定：
{
  "verdict": "值得买 | 谨慎入手 | 别买 三选一",
  "verdict_reason": "一句话结论理由，必须引用上面出现的价格数字，60 字内",
  "price_position": "当前价相对历史与二手档位的位置，带百分比或金额，40 字内",
  "pros": ["3-5 条优点，每条一句，30 字内"],
  "cons": ["3-5 条缺点，每条一句，30 字内"],
  "pitfalls": ["3-5 条这台机器在当前价位最该防的坑，可操作，30 字内"],
  "sources": ["本报告实际用到的数据来源名，如 京东历史价 / 闲鱼样本中位价 / knowledge.json"]
}
只输出 JSON，不要任何多余文字。`,
  };

  const ai = await aiChat([system, user], { deep: true, json: true, temperature: 0.3, maxTokens: 1600 });
  if ("error" in ai) return json({ error: "AI 通道繁忙", detail: ai.error }, 502);

  const parsed = parseJsonLoose<Record<string, unknown>>(ai.text);
  if (!parsed || typeof parsed !== "object") return json({ error: "AI 通道繁忙", detail: "报告 JSON 解析失败" }, 502);

  const report: Report = {
    model_id: id,
    verdict: pickVerdict(parsed.verdict),
    verdict_reason: String(parsed.verdict_reason ?? "").slice(0, 300),
    price_position: String(parsed.price_position ?? "").slice(0, 200),
    pros: strArr(parsed.pros, 6),
    cons: strArr(parsed.cons, 6),
    pitfalls: strArr(parsed.pitfalls, 6),
    sources: strArr(parsed.sources, 8),
    generated_at: new Date().toISOString(),
  };

  try {
    writeReport(report);
  } catch (e) {
    return json({ error: "报告落盘失败", detail: String((e as Error).message || e) }, 500);
  }

  return json({ ...report, cached: false, model_used: ai.model });
}
