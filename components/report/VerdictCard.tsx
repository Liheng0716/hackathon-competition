import { VERDICT_STYLE, verdictOf } from "./format";

export type VerdictCardProps = {
  verdict: string;
  reason: string;
  modelName?: string;
  demo?: boolean;
};

export default function VerdictCard({ verdict, reason, modelName, demo = false }: VerdictCardProps) {
  const key = verdictOf(verdict);
  const style = VERDICT_STYLE[key];

  return (
    <section className={`rounded-2xl ${style.bg} p-5 ring-1 ${style.ring} print:break-inside-avoid`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${style.chip}`}>{style.label}</span>
          <span className={`text-xs font-medium ${style.text}`}>AI 决策结论</span>
        </div>
        {demo ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800">演示数据</span>
        ) : null}
      </div>

      {modelName ? <p className="mt-3 text-xs text-slate-500">{modelName}</p> : null}

      <p className={`mt-2 text-base font-medium leading-relaxed ${style.text}`}>{reason}</p>
    </section>
  );
}
