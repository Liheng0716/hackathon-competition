// POST /api/verify —— 拍照识机（泳道2）
// body: { image: "data:image/jpeg;base64,..." }（也接受纯 base64）
// 流程：aiVision(glm-4v-flash) → parseJsonLoose；解析失败用 qwen3-vl-plus 备选再试一次；
//       仍失败 502 { error: "AI 通道繁忙" }；缺 image 400。
import type { ChatMessage } from "@/lib/ai";
import { aiVision, parseJsonLoose } from "@/lib/ai";
import type { Model } from "@/lib/data";
import { readModels } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROMPT = `看这张二手数码产品实拍照片，做「识机 + 评成色」。
要求：
1. 只判断画面主视觉里的那一台设备，忽略背景与配件。
2. category 用中文品类（手机/平板/笔记本/耳机/手表/其他）。
3. model_guess 写到可交易的型号名（如「iPhone 13」），看不出就给最接近的猜测。
4. confidence 是 0-100 的整数，表示你对自己判断的把握。
5. visible_defects 逐条列出可见瑕疵，severity 只能用 轻微/中等/严重 三个值之一。
6. condition_score 是 0-100 的整数，按五档意识打分：99新≥95、95新 85-94、9成新 70-84、8成新 55-69、大修或功能缺陷 <55。
7. notes 用一句话总结，20 字以内。
只输出 JSON，不要任何多余文字。
格式示例：
{"category":"手机","model_guess":"iPhone 13","confidence":86,"visible_defects":[{"area":"屏幕","type":"划痕","severity":"轻微","detail":"右下角细划"}],"condition_score":85,"notes":"整体良好"}`;

const RETRY_PROMPT = PROMPT + `\n注意：上一次回复不是合法 JSON。这次第一字符必须是 {，最后一字符必须是 }，不要解释，不要 Markdown 代码块。`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[\s\-_/\\()（）【】\[\]·,，。.:：+*"']/g, "");
}

/** 把 AI 猜的型号名对到机型目录，用于后续跳报告/估价 */
function matchModel(guess: unknown, models: Model[]): Model | null {
  const g = norm(guess);
  if (!g) return null;
  let best: { m: Model; score: number } | null = null;
  for (const m of models) {
    const name = norm(m.name);
    const variant = norm(m.variant);
    let score = 0;
    if (name && g.includes(name)) score += 10;
    else if (name && name.includes(g) && g.length >= 3) score += 6;
    if (variant && g.includes(variant)) score += 3;
    if (g.includes(norm(m.brand))) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { m, score };
  }
  return best ? best.m : null;
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

const SEVERITIES = ["轻微", "中等", "严重"];

/** 归一成 README 的固定结构，字段缺失也补齐，前端不用防御 */
function normalizeVision(raw: Record<string, unknown>, models: Model[]) {
  const defectsRaw = Array.isArray(raw.visible_defects) ? (raw.visible_defects as Record<string, unknown>[]) : [];
  const visible_defects = defectsRaw.slice(0, 12).map((d) => {
    const o = (d || {}) as Record<string, unknown>;
    const sev = String(o.severity ?? "").trim();
    return {
      area: String(o.area ?? "未知").slice(0, 20),
      type: String(o.type ?? "瑕疵").slice(0, 20),
      severity: (SEVERITIES.includes(sev) ? sev : sev.includes("严重") || sev.includes("重") ? "严重" : sev.includes("中") ? "中等" : "轻微") as string,
      detail: String(o.detail ?? "").slice(0, 60),
    };
  });

  const matched = matchModel(raw.model_guess, models);
  return {
    category: String(raw.category ?? "手机").slice(0, 12),
    model_guess: String(raw.model_guess ?? "未知").slice(0, 40),
    confidence: clampInt(raw.confidence, 0, 100, 60),
    visible_defects,
    condition_score: clampInt(raw.condition_score, 0, 100, 75),
    notes: String(raw.notes ?? "").slice(0, 60),
    matched_model_id: matched ? matched.id : null,
    matched_model_label: matched ? `${matched.name} ${matched.variant}`.trim() : null,
  };
}

/** 备选通道：直连 DashScope OpenAI 兼容口，只跑 qwen3-vl-plus，不走 lib/ai 的模型链 */
async function backupVision(image: string, prompt: string): Promise<string | null> {
  const key = process.env.DASHSCOPE_KEY;
  if (!key) return null;
  const base = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.QWEN_VISION_MODEL || "qwen3-vl-plus";
  const url = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
  const messages: ChatMessage[] = [
    { role: "system", content: "你是数码产品验机专家，只输出 JSON，不要任何多余文字。" },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url } },
      ],
    },
  ];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 1024 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求体不是合法 JSON，需要 { image: \"data:image/jpeg;base64,...\" }" }, 400);
  }

  const image = typeof body?.image === "string" ? body.image.trim() : "";
  if (!image) return json({ error: "缺少 image（data:image/...;base64,... 或纯 base64）" }, 400);
  if (image.length > 12_000_000) return json({ error: "图片过大，请压到 8MB 以内" }, 413);

  const models = readModels();

  // 第一次：lib/ai 视觉链（glm-4v-flash → 失败内建切 qwen3-vl-plus）
  const first = await aiVision(image, PROMPT, { timeoutMs: 55_000 });
  if ("text" in first) {
    const parsed = parseJsonLoose<Record<string, unknown>>(first.text);
    if (parsed && typeof parsed === "object") {
      return json({ ...normalizeVision(parsed, models), model_used: first.model });
    }
  }

  // 第二次：换备选模型重试一次
  const backupText = await backupVision(image, RETRY_PROMPT);
  if (backupText) {
    const parsed = parseJsonLoose<Record<string, unknown>>(backupText);
    if (parsed && typeof parsed === "object") {
      return json({
        ...normalizeVision(parsed, models),
        model_used: process.env.QWEN_VISION_MODEL || "qwen3-vl-plus",
      });
    }
  }

  // 走 lib/ai 的备选链再兜一次（覆盖 GLM 成功但 JSON 烂、且没配 DASHSCOPE_KEY 的情况）
  const third = await aiVision(image, RETRY_PROMPT, { timeoutMs: 55_000 });
  if ("text" in third) {
    const parsed = parseJsonLoose<Record<string, unknown>>(third.text);
    if (parsed && typeof parsed === "object") {
      return json({ ...normalizeVision(parsed, models), model_used: third.model });
    }
  }

  return json({ error: "AI 通道繁忙" }, 502);
}
