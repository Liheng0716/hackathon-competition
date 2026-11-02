// 泳道1B 内部小工具，不外溢到 lib/
import type { VerifySeverity } from "./types";

export function sevKey(sev?: string): VerifySeverity {
  const s = (sev ?? "").trim();
  if (s.includes("严重") || s.includes("重")) return "严重";
  if (s.includes("中")) return "中等";
  return "轻微";
}

export const SEVERITY_STYLE: Record<
  VerifySeverity,
  { badge: string; chip: string; cell: string; dot: string; text: string }
> = {
  轻微: {
    badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    chip: "bg-slate-800/85 text-white",
    cell: "bg-slate-400/25 border-white/40",
    dot: "bg-slate-400",
    text: "text-slate-600",
  },
  中等: {
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    chip: "bg-orange-500 text-white",
    cell: "bg-orange-400/30 border-orange-200/80",
    dot: "bg-orange-500",
    text: "text-orange-700",
  },
  严重: {
    badge: "bg-red-50 text-red-700 ring-1 ring-red-200",
    chip: "bg-red-600 text-white",
    cell: "bg-red-500/30 border-red-300/80",
    dot: "bg-red-600",
    text: "text-red-700",
  },
};

export function scoreColor(n: number): string {
  if (n >= 85) return "#16a34a";
  if (n >= 70) return "#eab308";
  if (n >= 60) return "#f97316";
  return "#dc2626";
}

export function scoreLabel(n: number): string {
  if (n >= 90) return "接近全新";
  if (n >= 85) return "99新水平";
  if (n >= 70) return "正常二手";
  if (n >= 60) return "痕迹明显";
  return "高风险，慎买";
}

// 翻新 / 大修关键词：命中即弹黄条；「无拆修」「未进水」这类否定表述不算命中
const RISK_RE = /维修|进水|拆修|更换|换过|后换|浸液|修过|换屏|换电池/g;
const NEG_RE = /无|未|非|没|不/;

function firstRiskWord(notes: string): string | null {
  RISK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RISK_RE.exec(notes)) !== null) {
    const before = notes.slice(Math.max(0, m.index - 3), m.index);
    if (NEG_RE.test(before)) continue;
    return m[0];
  }
  return null;
}

export function renovationRisk(score: number, notes?: string): { risky: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (Number.isFinite(score) && score < 70) reasons.push(`成色分 ${Math.round(score)} < 70`);
  const hit = firstRiskWord(notes ?? "");
  if (hit) reasons.push(`备注含「${hit}」`);
  return { risky: reasons.length > 0, reasons };
}

export function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
