// 验机结果契约 —— 与 docs/README-dev.md「识机 API 返回固定结构」逐字对齐，不得改名
export type VerifySeverity = "轻微" | "中等" | "严重";

export type VerifyDefect = {
  area: string;
  type: string;
  severity?: VerifySeverity | string;
  detail?: string;
};

export type VerifyResult = {
  category?: string;
  model_guess: string;
  confidence: number;
  visible_defects: VerifyDefect[];
  condition_score: number;
  notes?: string;
};
