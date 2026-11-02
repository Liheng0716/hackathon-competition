"use client";

import {
  GRID_CELLS,
  type VisibleDefect,
  isBlockArea,
  severityStyle,
} from "./types";

interface GridOverlayProps {
  /** 原图地址（blob URL / data URL），作为九宫格底色 */
  imageUrl?: string;
  defects: VisibleDefect[];
}

/**
 * 照片九宫格瑕疵覆盖层：
 * - area 命中九宫格位置 → 高亮对应格
 * - area 为 屏幕/边框/背面/镜头 → 整块（全九宫格）高亮
 * 每个高亮格右上角显示瑕疵类型角标，配色随严重度变化。
 */
export default function GridOverlay({ imageUrl, defects }: GridOverlayProps) {
  const cellDefects: Record<string, VisibleDefect[]> = {};
  let blockDefects: VisibleDefect[] = [];

  for (const d of defects) {
    if (isBlockArea(d.area)) {
      blockDefects.push(d);
      continue;
    }
    if (!cellDefects[d.area]) cellDefects[d.area] = [];
    cellDefects[d.area].push(d);
  }

  const hasBlock = blockDefects.length > 0;

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {/* 底图 */}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="待检照片"
            className="block h-auto w-full object-contain"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center text-sm text-slate-400">
            暂无照片
          </div>
        )}

        {/* 九宫格覆盖层 */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {GRID_CELLS.map((cell) => {
            const own = cellDefects[cell] ?? [];
            const active = hasBlock || own.length > 0;
            const list = hasBlock ? blockDefects : own;
            const top = list[0];
            const style = severityStyle(top?.severity ?? "轻微");
            return (
              <div
                key={cell}
                className={`relative border transition-colors ${
                  active
                    ? `border-2 ${style.cell}`
                    : "border border-white/40"
                }`}
              >
                {/* 格名水印，便于开发期对照 */}
                {!active && (
                  <span className="absolute left-1 top-1 text-[10px] text-white/70">
                    {cell}
                  </span>
                )}
                {active && (
                  <div className="absolute right-1 top-1 flex flex-col items-end gap-1">
                    {list.slice(0, 3).map((d, i) => {
                      const s = severityStyle(d.severity);
                      return (
                        <span
                          key={`${d.area}-${d.type}-${i}`}
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${s.badge}`}
                        >
                          {d.type}·{d.severity}
                        </span>
                      );
                    })}
                    {list.length > 3 && (
                      <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-white">
                        +{list.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {hasBlock && (
        <p className="mt-2 text-xs text-slate-500">
          整块高亮区域：
          {Array.from(new Set(blockDefects.map((d) => d.area))).join("、")}
        </p>
      )}
    </div>
  );
}
