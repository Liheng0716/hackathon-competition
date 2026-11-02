import { parsePercentile, priceZone } from "./format";

export type PricePositionProps = { text: string };

export default function PricePosition({ text }: PricePositionProps) {
  const p = parsePercentile(text);
  const zone = priceZone(p);
  const width = p === null ? 0 : Math.min(100, Math.max(2, p));

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 print:break-inside-avoid">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">价格位置</h2>
        <span className={`text-xs font-medium ${zone.className}`}>{zone.label}</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-700">{text}</p>

      <div className="mt-3">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-400">
          {p !== null ? (
            <span
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
              style={{ left: `${width}%` }}
            />
          ) : null}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>历史最低</span>
          <span>中位</span>
          <span>历史最高</span>
        </div>
        {p !== null ? <p className="mt-1 text-[11px] text-slate-500">当前处于近 30 天 {p}% 百分位</p> : null}
      </div>
    </section>
  );
}
