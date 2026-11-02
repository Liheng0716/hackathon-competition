// lib/ai.ts —— OpenAI 兼容适配层（泳道3 维护，其他泳道只调用不修改）
// 约定：aiChat(messages, opts) / aiVision(imageB64, prompt, opts)
// 选型：opts.vision → glm-4v-flash，失败切 qwen3-vl-plus
//       opts.deep   → glm-5.3-flash，失败切 qwen-plus
//       默认        → qwen-plus，失败切 glm-5.3-flash
// 每个模型重试 1 次；全部失败返回 { error }，前端显示「AI 通道繁忙」。

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type AiOpts = {
  vision?: boolean;
  deep?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  json?: boolean;
};

export type AiResult = { text: string; model: string; raw?: unknown } | { error: string };

const GLM_BASE = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
const QWEN_BASE =
  process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";

const GLM_TEXT = process.env.GLM_TEXT_MODEL || "glm-5.3-flash";
const QWEN_TEXT = process.env.QWEN_TEXT_MODEL || "qwen-plus";
const GLM_VISION = process.env.GLM_VISION_MODEL || "glm-4v-flash";
const QWEN_VISION = process.env.QWEN_VISION_MODEL || "qwen3-vl-plus";

function providerOf(model: string): { base: string; key: string | undefined; name: string } {
  if (model.startsWith("glm")) {
    return { base: GLM_BASE, key: process.env.ZHIPU_KEY, name: "zhipu" };
  }
  return { base: QWEN_BASE, key: process.env.DASHSCOPE_KEY, name: "dashscope" };
}

function modelChain(opts: AiOpts): string[] {
  if (opts.vision) return [GLM_VISION, QWEN_VISION];
  if (opts.deep) return [GLM_TEXT, QWEN_TEXT];
  return [QWEN_TEXT, GLM_TEXT];
}

async function callOnce(
  model: string,
  messages: ChatMessage[],
  opts: AiOpts
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const { base, key } = providerOf(model);
  if (!key) return { ok: false, error: `missing key for ${model}` };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 2048,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status} ${body.slice(0, 300)}` };
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return { ok: false, error: "empty completion" };
    return { ok: true, text };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "timeout" : String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function aiChat(messages: ChatMessage[], opts: AiOpts = {}): Promise<AiResult> {
  const errors: string[] = [];
  for (const model of modelChain(opts)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await callOnce(model, messages, opts);
      if (r.ok) return { text: r.text, model };
      errors.push(`${model}#${attempt + 1}: ${r.error}`);
    }
  }
  return { error: `AI 通道繁忙：${errors.join(" | ")}` };
}

// imageB64 允许带 data:image/...;base64, 前缀，也允许纯 base64
export async function aiVision(
  imageB64: string,
  prompt: string,
  opts: AiOpts = {}
): Promise<AiResult> {
  const url = imageB64.startsWith("data:") ? imageB64 : `data:image/jpeg;base64,${imageB64}`;
  return aiChat(
    [
      { role: "system", content: "你是数码产品验机专家，只输出 JSON，不要任何多余文字。" },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url } },
        ],
      },
    ],
    { ...opts, vision: true, json: true, maxTokens: 1024 }
  );
}

// 容错解析：剥掉 ```json 包裹、截取第一个 { 到最后一个 }
export function parseJsonLoose<T = any>(text: string): T | null {
  if (!text) return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
