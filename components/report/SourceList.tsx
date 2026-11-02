import type { ReportSource } from "./types";

export default function SourceList({ sources }: { sources: ReportSource[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">数据来源</h3>
      {sources.length === 0 ? (
        <p className="text-sm text-slate-400">暂无来源</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {sources.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-slate-400">{i + 1}.</span>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline-offset-2 hover:underline"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
