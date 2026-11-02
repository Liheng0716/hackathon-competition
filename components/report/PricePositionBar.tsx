import type { NormalizedPricePosition } from "./types";

export default function PricePositionBar({
  position,
}: {
  position: NormalizedPricePosition;
}) {
  const { percentile, current, low, high, label } = position;

  // 没有百分位（泳道3 可能只给文字描述）→ 降级展示
  if (percentile == null) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">价格位置</h2>
        <p className="text-sm text-slate-500">
          {label || "暂无价格位置数据"}
        </p>
      </section>
    );
  }

  const p = Math.min(100, Math.max(0, percentile));
  const hint = p <= 30 ? "处于历史低位" : p <= 70 ? "处于历史中位" : "接近历史高位";
  const markerColor =
    p <= 30 ? "bg-green-500" : p <= 70 ? "bg-amber-500" : "bg-red-500";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">价格位置</h2>
        <span className="text-xs text-slate-500">
          比历史 {100 - p}% 的时间更便宜 · {label || hint}
        </span>
      </div>

      <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-green-400 via-amber-400 to-red-400">
        <div
          className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${markerColor}`}
          style={{ left: `${p}%` }}
          aria-label={`历史百分位 ${p}%`}
        />
      </div>

      {(current != null || low != null || high != null) && (
        <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
          <div>
            <div className="text-slate-800">¥{low ?? "—"}</div>
            <div>历史最低</div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">¥{current ?? "—"}</div>
            <div>当前价</div>
          </div>
          <div>
            <div className="text-slate-800">¥{high ?? "—"}</div>
            <div>历史最高</div>
          </div>
        </div>
      )}
    </section>
  );
}
