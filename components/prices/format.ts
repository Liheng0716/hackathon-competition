// 泳道1A · 行情页本地格式化工具（不新建 lib 公共文件）
export type FreshLevel = "fresh" | "warn" | "stale" | "unknown";

/** 价格：3779 -> ¥3,779；缺值 -> — */
export function formatPrice(n?: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return "¥" + Math.round(n).toLocaleString("zh-CN");
}

/** 短日期 10-04 */
export function shortDate(iso?: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "—";
  const d = new Date(t);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 日期+时分 10-04 20:00 */
export function dateTime(iso?: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "—";
  const d = new Date(t);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 数据龄：更新于 x 分钟/小时/天前
 * >48h -> warn（黄），>7 天 -> stale（红）
 */
export function relativeTime(
  iso?: string,
  now: number = Date.now()
): { text: string; level: FreshLevel; hours: number } {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return { text: "更新时间未知", level: "unknown", hours: NaN };
  const diff = now - t;
  const hours = diff / 3_600_000;
  const mins = Math.max(0, Math.round(diff / 60_000));
  let text: string;
  if (mins < 1) text = "更新于 刚刚";
  else if (mins < 60) text = `更新于 ${mins} 分钟前`;
  else if (hours < 24) text = `更新于 ${Math.floor(hours)} 小时前`;
  else text = `更新于 ${Math.floor(hours / 24)} 天前`;
  const level: FreshLevel = hours > 168 ? "stale" : hours > 48 ? "warn" : "fresh";
  return { text, level, hours };
}

/** 中位价（整数） */
export function median(nums: number[]): number {
  const v = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

/** 品类：机型目录全部为手机（models.json 无 category 字段，不新增字段） */
export function categoryOf(): string {
  return "手机";
}
