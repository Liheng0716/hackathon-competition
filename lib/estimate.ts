// lib/estimate.ts —— 二手估价引擎（泳道2）
// 口径：五档成色 → 系数表（基准锚定 95新 中位价）；answers 修正项 拆修/进水/无盒配件
// 计算链：95新基准价 base95 → 系数折算 mid → 修正项 → 区间 low/high（四舍五入到十位）
// 说明：coefficient 是相对 95新 的折算比，所以目标价 = base95 × coef(grade) / coef(95新)，
//       直接用 coef(grade) 乘 95新 基准价会二次折扣（D3 用真实样本回归后统一改系数表即可）。

export const GRADES = ["99新", "95新", "9成新", "8成新", "大修或功能缺陷"] as const;
export type Grade = (typeof GRADES)[number];

/** 五档系数（D3 用真实样本回归后更新；改动只改这一张表） */
export const GRADE_COEF: Record<Grade, number> = {
  "99新": 0.92,
  "95新": 0.85,
  "9成新": 0.76,
  "8成新": 0.65,
  "大修或功能缺陷": 0.5,
};

/** 基准档位：所有系数以它为中轴 */
export const BASE_GRADE: Grade = "95新";
export const BASE_COEF: number = GRADE_COEF[BASE_GRADE];

/** answers 修正项（乘性） */
export const FIX_COEF = {
  repaired: -0.08, // 拆修
  water: -0.15, // 进水
  no_box: -0.03, // 无盒配件
} as const;

/** 区间宽度 */
export const RANGE_LOW = 0.92;
export const RANGE_HIGH = 1.08;

export type AnswerValue = string | boolean | number | null | undefined;

export type Answers = {
  screen_scratches?: AnswerValue;
  frame_dents?: AnswerValue;
  repaired?: AnswerValue;
  water?: AnswerValue;
  box_accessories?: AnswerValue;
};

export type SampleLike = {
  model_id?: string;
  platform?: string;
  title?: string;
  price: number;
  grade?: string;
};

export type EstimateInput = {
  grade?: string | null;
  answers?: Answers | null;
  samples?: SampleLike[];
  new_price?: number | null;
  model_name?: string;
  model_label?: string;
};

export type EstimateResult = {
  low: number;
  mid: number;
  high: number;
  basis: string[];
  grade: Grade;
  coef: number;
  sample_count: number;
  target_sample_count: number;
  base95: number | null;
  new_price: number | null;
  source: "used_samples" | "new_price_fallback";
  confidence: "high" | "medium" | "low";
};

/* ------------------------------ 小工具 ------------------------------ */

export function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

export function median(nums: number[]): number | null {
  const arr = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return null;
  const m = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
}

export function formatYuan(n: number): string {
  return "¥" + Math.round(n).toLocaleString("zh-CN");
}

const TRUTHY = ["yes", "true", "1", "有", "是", "拆修", "修过", "进水", "泡水", "动过主板"];
const FALSY = ["no", "false", "0", "无", "没有", "否", "没", "未", "none", "null", ""];

function str(v: AnswerValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v).trim().toLowerCase();
}

/** 明确为「有」 */
export function isYes(v: AnswerValue): boolean {
  const s = str(v);
  if (!s) return false;
  if (FALSY.includes(s)) return false;
  return TRUTHY.some((t) => s === t || s.includes(t));
}

/** 明确为「无」（空值不算无，空值=未答） */
export function isNo(v: AnswerValue): boolean {
  const s = str(v);
  if (!s) return false;
  return FALSY.some((t) => t && (s === t || s.includes(t)));
}

/** 外观严重度：none | light | heavy（未答 = null） */
export function severity(v: AnswerValue): "none" | "light" | "heavy" | null {
  const s = str(v);
  if (!s) return null;
  if (["heavy", "severe", "严重", "明显", "多处", "2", "多"].some((t) => s === t || s.includes(t))) return "heavy";
  if (["light", "轻微", "轻", "1", "小"].some((t) => s === t || s.includes(t))) return "light";
  if (["none", "no", "无", "没有", "0", "false", "全新"].some((t) => s === t || s.includes(t))) return "none";
  return null;
}

export function isGrade(x: unknown): x is Grade {
  return typeof x === "string" && (GRADES as readonly string[]).includes(x);
}

/** 宽松归一：'95'/'95新'/'九五新'/'九成新'/'8成'/'大修' 等一律归到五档 */
export function normalizeGrade(input: unknown): Grade | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;
  if (isGrade(s)) return s;
  const t = s.replace(/\s+/g, "").replace(/九五/g, "95").replace(/八成新/g, "8成新").replace(/九成新/g, "9成新");
  if (/99|九成九/.test(t)) return "99新";
  if (/95/.test(t)) return "95新";
  if (/^(9|九)成|9成|90/.test(t)) return "9成新";
  if (/^(8|八)成|8成|80/.test(t)) return "8成新";
  if (/大修|故障|进水|坏|修过|不开机|维修/.test(t)) return "大修或功能缺陷";
  return null;
}

/** 没传 grade 时，用外观问答反推档位 */
export function deriveGrade(answers: Answers | null | undefined): Grade {
  const a = answers || {};
  const screen = severity(a.screen_scratches);
  const frame = severity(a.frame_dents);
  if (isYes(a.water)) return "大修或功能缺陷";
  if (screen === "heavy" || frame === "heavy") return "8成新";
  if (screen === "light" || frame === "light") return "9成新";
  if (screen === "none" && frame === "none") return "99新";
  if (screen === "none" || frame === "none") return "95新";
  return BASE_GRADE;
}

/** 每个档位的中位价（无样本的档位给 null），键固定为五档 */
export function medianByGrade(samples: SampleLike[]): Record<Grade, number | null> {
  const buckets: Record<string, number[]> = {};
  for (const s of samples || []) {
    const g = normalizeGrade(s.grade);
    const p = Number(s.price);
    if (!g || !Number.isFinite(p) || p <= 0) continue;
    (buckets[g] ||= []).push(p);
  }
  const out = {} as Record<Grade, number | null>;
  for (const g of GRADES) out[g] = median(buckets[g] || []);
  return out;
}

/* ------------------------------ 主算路 ------------------------------ */

/** 把任意档位的样本价折算成「95新 等价价」 */
function eq95(price: number, grade: Grade): number {
  return price * (BASE_COEF / GRADE_COEF[grade]);
}

type Entry = { price: number; grade: Grade };

function entries(samples: SampleLike[]): Entry[] {
  const out: Entry[] = [];
  for (const s of samples || []) {
    const g = normalizeGrade(s.grade);
    const p = Number(s.price);
    if (!g || !Number.isFinite(p) || p <= 0) continue;
    out.push({ price: p, grade: g });
  }
  return out;
}

/** 距基准档位 radius 档以内的样本（±1 档 = radius 1） */
function near(rows: Entry[], center: Grade, radius: number): Entry[] {
  const ci = GRADES.indexOf(center);
  return rows.filter((r) => Math.abs(GRADES.indexOf(r.grade) - ci) <= radius);
}

export function computeEstimate(input: EstimateInput): EstimateResult {
  const rows = entries(input.samples || []);
  const answers = input.answers || {};
  const grade = normalizeGrade(input.grade) ?? deriveGrade(answers);
  const coef = GRADE_COEF[grade];
  const label = input.model_label || input.model_name || "该机型";
  const basis: string[] = [];

  // 目标档位直接样本
  const targetRows = rows.filter((r) => r.grade === grade);
  const targetMedian = median(targetRows.map((r) => r.price));
  const targetCount = targetRows.length;

  // 95新 基准价：先在 95新 找样本；不足 2 条就按 ±1 档展开后折算回 95新 等价价
  let base95: number | null = null;
  let anchorCount = 0;
  let anchorRadius = -1;
  for (const radius of [0, 1, 2]) {
    const win = near(rows, BASE_GRADE, radius);
    if (!win.length) continue;
    const vals = win.map((r) => eq95(r.price, r.grade));
    if (vals.length >= 2) {
      base95 = median(vals);
      anchorCount = vals.length;
      anchorRadius = radius;
      break;
    }
    if (base95 === null) {
      base95 = median(vals);
      anchorCount = vals.length;
      anchorRadius = radius;
    }
  }
  if (base95 === null && rows.length) {
    const vals = rows.map((r) => eq95(r.price, r.grade));
    base95 = median(vals);
    anchorCount = vals.length;
    anchorRadius = 9;
  }

  const anchorText =
    anchorRadius === 0
      ? `${label} 的 95新 二手样本 ${anchorCount} 条，中位价 ${formatYuan(base95 ?? 0)}`
      : anchorRadius === 9
        ? `${label} 全档位样本 ${anchorCount} 条统一折算到 95新 等价价，中位 ${formatYuan(base95 ?? 0)}`
        : `${label} 的 95新 样本不足，取 95新±${anchorRadius} 档 ${anchorCount} 条按系数折算回 95新 等价价，中位 ${formatYuan(base95 ?? 0)}`;

  let midRaw: number;
  let source: EstimateResult["source"] = "used_samples";

  if (base95 !== null && targetCount >= 2 && targetMedian !== null) {
    const derived = (base95 * coef) / BASE_COEF;
    midRaw = targetMedian * 0.7 + derived * 0.3;
    basis.push(`基准：${anchorText}（锚定 ${BASE_GRADE}，系数 ${BASE_COEF}）。`);
    basis.push(
      `档位折算：${BASE_GRADE} 基准 ${formatYuan(base95)} × ${coef} / ${BASE_COEF} = ${formatYuan(derived)}（${grade} 系数 ${coef}）。`
    );
    basis.push(
      `样本校正：${grade} 档实测 ${targetCount} 条，中位价 ${formatYuan(targetMedian)}，与系数推算值按 7:3 加权得 ${formatYuan(midRaw)}。`
    );
  } else if (base95 !== null) {
    midRaw = (base95 * coef) / BASE_COEF;
    basis.push(`基准：${anchorText}（锚定 ${BASE_GRADE}，系数 ${BASE_COEF}）。`);
    basis.push(
      `档位折算：${formatYuan(base95)} × ${coef} / ${BASE_COEF} = ${formatYuan(midRaw)}。` +
        (targetCount === 1
          ? `${grade} 档仅 1 条样本，样本量不足，不直接采信。`
          : `${grade} 档无实测样本，按系数表推算。`)
    );
  } else if (input.new_price && Number.isFinite(input.new_price) && input.new_price > 0) {
    source = "new_price_fallback";
    midRaw = input.new_price * coef;
    basis.push(`回退：${label} 暂无二手样本，按新机价 ${formatYuan(input.new_price)} × ${grade} 系数 ${coef} = ${formatYuan(midRaw)} 估算。`);
    basis.push(`回退口径精度较低（无样本支撑），样本入库后会自动改用中位价口径。`);
  } else {
    midRaw = 0;
    source = "new_price_fallback";
    basis.push(`${label} 既无二手样本也无新机价，无法给出可靠估价，返回 0，请补样本或补 prices_current.json。`);
  }

  // answers 修正项
  let factor = 1;
  if (isYes(answers.repaired)) {
    factor *= 1 + FIX_COEF.repaired;
    basis.push(`修正：有拆修记录 ${(FIX_COEF.repaired * 100).toFixed(0)}%，扣 ${formatYuan(midRaw * -FIX_COEF.repaired)}。`);
  }
  if (isYes(answers.water)) {
    factor *= 1 + FIX_COEF.water;
    basis.push(`修正：有进水/泡水史 ${(FIX_COEF.water * 100).toFixed(0)}%，扣 ${formatYuan(midRaw * -FIX_COEF.water)}。`);
  }
  if (isNo(answers.box_accessories) || ["裸机", "仅主机", "单机"].some((w) => str(answers.box_accessories).includes(w))) {
    factor *= 1 + FIX_COEF.no_box;
    basis.push(`修正：无盒无配件 ${(FIX_COEF.no_box * 100).toFixed(0)}%，扣 ${formatYuan(midRaw * -FIX_COEF.no_box)}。`);
  }
  if (!isYes(answers.repaired) && !isYes(answers.water) && !isNo(answers.box_accessories)) {
    basis.push(`修正：未申报拆修/进水/缺配件，不加扣分项。`);
  }

  let mid = round10(Math.max(midRaw * factor, 0));
  const low = round10(mid * RANGE_LOW);
  const high = round10(mid * RANGE_HIGH);
  basis.push(`区间：中位 ${formatYuan(mid)}，下沿 ×${RANGE_LOW} = ${formatYuan(low)}，上沿 ×${RANGE_HIGH} = ${formatYuan(high)}（四舍五入到十位）。`);

  const confidence: EstimateResult["confidence"] =
    source === "new_price_fallback" ? "low" : rows.length >= 6 && targetCount >= 2 ? "high" : rows.length >= 3 ? "medium" : "low";
  basis.push(
    `样本量：该机型共 ${rows.length} 条有效样本，${grade} 档 ${targetCount} 条，置信度 ${confidence === "high" ? "高" : confidence === "medium" ? "中" : "低"}。`
  );

  return {
    low,
    mid,
    high,
    basis,
    grade,
    coef,
    sample_count: rows.length,
    target_sample_count: targetCount,
    base95: base95 === null ? null : Math.round(base95),
    new_price: input.new_price && input.new_price > 0 ? input.new_price : null,
    source,
    confidence,
  };
}
