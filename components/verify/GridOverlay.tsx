import type { VerifyDefect } from "./types";
import { SEVERITY_STYLE, sevKey } from "./format";

const ROWS: string[][] = [
  ["上左", "上中", "上右"],
  ["中左", "正中", "中右"],
  ["下左", "下中", "下右"],
];
const CELLS = ROWS.flat();

// 同义写法归一
const ALIAS: Record<string, string> = {
  左上: "上左",
  正上: "上中",
  顶部: "上中",
  右上: "上右",
  左边: "中左",
  中央: "正中",
  中心: "正中",
  中间: "正中",
  右边: "中右",
  左下: "下左",
  正下: "下中",
  底部: "下中",
  右下: "下右",
};

// 这些区域不是某一格，而是整块（整张照片）命中
const WHOLE_AREAS = ["屏幕", "边框", "背面", "镜头", "接口", "正面", "机身", "外壳", "摄像头", "侧面"];

type Hit = { defect: VerifyDefect };

function worstSeverity(defects: VerifyDefect[]): "轻微" | "中等" | "严重" {
  let rank = 0;
  for (const d of defects) {
    const k = sevKey(d.severity);
    const r = k === "严重" ? 3 : k === "中等" ? 2 : 1;
    if (r > rank) rank = r;
  }
  return rank >= 3 ? "严重" : rank === 2 ? "中等" : "轻微";
}

export type GridOverlayProps = {
  src: string;
  alt?: string;
  defects?: VerifyDefect[];
  className?: string;
};

export default function GridOverlay({ src, alt = "待检照片", defects = [], className = "" }: GridOverlayProps) {
  const byCell = new Map<string, VerifyDefect[]>();
  const whole: VerifyDefect[] = [];

  for (const d of defects) {
    const raw = (d.area ?? "").trim();
    const key = ALIAS[raw] ?? raw;
    if (WHOLE_AREAS.includes(key)) {
      whole.push(d);
      continue;
    }
    if (CELLS.includes(key)) {
      const list = byCell.get(key) ?? [];
      list.push(d);
      byCell.set(key, list);
      continue;
    }
    // 未收录的区域名：不丢，按整块角标展示
    whole.push(d);
  }

  const wholeSeverity = whole.length ? worstSeverity(whole) : null;
  const wholeRing =
    wholeSeverity === "严重"
      ? "ring-red-500/80"
      : wholeSeverity === "中等"
        ? "ring-orange-400/80"
        : "ring-slate-300/90";

  return (
    <figure className={`m-0 ${className}`}>
      <div className="relative overflow-hidden rounded-xl bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block w-full object-contain" />

        {/* 九宫格 */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {ROWS.map((row, ri) =>
            row.map((cell) => {
              const hits = byCell.get(cell) ?? [];
              const sev = hits.length ? worstSeverity(hits) : null;
              const style = sev ? SEVERITY_STYLE[sev] : null;
              return (
                <div
                  key={cell}
                  className={`relative border border-dashed border-white/25 ${style ? style.cell : ""}`}
                >
                  {hits.length > 0 && style ? (
                    <span
                      className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${style.chip}`}
                    >
                      {cell} · {Array.from(new Set(hits.map((h) => h.type))).join("/")}
                    </span>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>

        {/* 整块命中：外圈 + 右上角标 */}
        {whole.length > 0 ? (
          <div className={`pointer-events-none absolute inset-0 rounded-xl ring-4 ring-inset ${wholeRing}`}>
            <div className="absolute right-1.5 top-1.5 flex max-w-[85%] flex-col items-end gap-1">
              {whole.map((d, i) => (
                <span
                  key={`${d.area}-${d.type}-${i}`}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight shadow-sm ${
                    SEVERITY_STYLE[sevKey(d.severity)].chip
                  }`}
                >
                  {d.area} · {d.type}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>九宫格标注 · 命中格高亮</span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-slate-400" />轻微
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-orange-500" />中等
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-red-600" />严重
        </span>
        <span>屏幕/边框/背面/镜头/接口 = 整块高亮</span>
      </figcaption>
    </figure>
  );
}
