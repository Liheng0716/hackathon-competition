import { type ReportData, dataAge, verdictStyle } from "./types";

export default function DecisionCard({ report }: { report: ReportData }) {
  const v = verdictStyle(report.verdict);
  const age = dataAge(report.generated_at);
  const title = report.model_name ?? report.model_id;

  return (
    <section className={`rounded-2xl border-2 ${v.ring} p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full border px-3 py-1 text-sm font-bold ${v.badge}`}
        >
          {v.label}
        </span>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <span
          className={`ml-auto rounded-full px-2.5 py-1 text-xs ${
            age.stale
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-600"
          }`}
          title={report.generated_at}
        >
          {age.text}
        </span>
      </div>

      {report.current_price != null && (
        <div className="mt-4 flex items-end gap-2">
          <span className="text-sm text-slate-500">当前到手价</span>
          <span className="text-3xl font-extrabold text-slate-900">
            ¥{report.current_price}
          </span>
        </div>
      )}

      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        {report.verdict_reason}
      </p>
    </section>
  );
}
