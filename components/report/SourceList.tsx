import type { ReportSource } from "./types";

export type SourceListProps = { sources: ReportSource[] };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function SourceList({ sources }: SourceListProps) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 print:break-inside-avoid">
      <h2 className="text-sm font-semibold text-slate-900">
        数据来源
        <span className="ml-1 text-[11px] font-normal text-slate-400">{sources.length}</span>
      </h2>
      {sources.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">暂无来源链接</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`} className="flex items-start gap-2 text-xs">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <div className="min-w-0">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                >
                  {s.title || s.url}
                </a>
                {hostOf(s.url) ? <span className="ml-2 text-[10px] text-slate-400">{hostOf(s.url)}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
