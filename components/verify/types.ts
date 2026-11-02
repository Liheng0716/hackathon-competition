// 识机结果类型与展示用常量（泳道1B 私有，不跨泳道共享）
// JSON 契约见 docs/README-dev.md「数据与 API 契约」

export type DefectSeverity = "轻微" | "中等" | "严重";

export interface VisibleDefect {
  /** 九宫格位置（上左/上中/.../下右）或整块区域（屏幕/边框/背面/镜头/接口） */
  area: string;
  /** 瑕疵类型，如 划痕/磕碰/裂纹/污渍 */
  type: string;
  severity: DefectSeverity;
  /** 一句话描述（识机 v2 契约新增，可选） */
  detail?: string;
}

export interface VerifyResult {
  category: string;
  model_guess: string;
  /** 置信度 0-100 */
  confidence: number;
  visible_defects: VisibleDefect[];
  /** 成色分 0-100 */
  condition_score: number;
  notes: string;
}

/** 九宫格 9 格顺序（与 CSS grid 排列一致：上左→上中→上右→中左...） */
export const GRID_CELLS = [
  "上左",
  "上中",
  "上右",
  "中左",
  "正中",
  "中右",
  "下左",
  "下中",
  "下右",
] as const;

/** 整块高亮的特殊 area 值 */
export const BLOCK_AREAS = ["屏幕", "边框", "背面", "镜头", "接口"] as const;

export function isBlockArea(area: string): boolean {
  return (BLOCK_AREAS as readonly string[]).includes(area);
}

/** 严重度 → Tailwind 配色（轻微灰 / 中等橙 / 严重红） */
export const SEVERITY_STYLE: Record<
  DefectSeverity,
  { badge: string; cell: string; dot: string; text: string }
> = {
  轻微: {
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    cell: "border-slate-400 bg-slate-200/30",
    dot: "bg-slate-400",
    text: "text-slate-600",
  },
  中等: {
    badge: "bg-orange-100 text-orange-700 border-orange-300",
    cell: "border-orange-400 bg-orange-200/30",
    dot: "bg-orange-500",
    text: "text-orange-600",
  },
  严重: {
    badge: "bg-red-100 text-red-700 border-red-300",
    cell: "border-red-500 bg-red-200/40",
    dot: "bg-red-500",
    text: "text-red-600",
  },
};

export function severityStyle(severity: string) {
  return SEVERITY_STYLE[severity as DefectSeverity] ?? SEVERITY_STYLE["轻微"];
}

/** 成色分 → 五档成色（估价 API 的 grade 入参口径） */
export function conditionGrade(score: number): string {
  if (score >= 95) return "99新";
  if (score >= 85) return "95新";
  if (score >= 70) return "9成新";
  if (score >= 55) return "8成新";
  return "大修";
}

/** 机型名 → model_id 近似（识机返回只有 model_guess，估价 API 需要 id） */
export function guessModelId(modelGuess: string): string {
  return modelGuess.trim().toLowerCase().replace(/\s+/g, "-");
}
