export type ProsConsPitfallsProps = {
  pros: string[];
  cons: string[];
  pitfalls: string[];
};

function Column({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: string[];
  tone: "pros" | "cons" | "pitfalls";
  empty: string;
}) {
  const head =
    tone === "pros" ? "text-emerald-700" : tone === "cons" ? "text-orange-700" : "text-red-700";
  const dot = tone === "pros" ? "bg-emerald-500" : tone === "cons" ? "bg-orange-500" : "bg-red-500";
  const box =
    tone === "pros"
      ? "border-emerald-100 bg-emerald-50/40"
      : tone === "cons"
        ? "border-orange-100 bg-orange-50/40"
        : "border-red-100 bg-red-50/40";

  return (
    <div className={`rounded-2xl border ${box} p-4 print:break-inside-avoid`}>
      <h3 className={`text-sm font-semibold ${head}`}>
        {title}
        <span className="ml-1 text-[11px] font-normal text-slate-400">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((t, i) => (
            <li key={`${tone}-${i}`} className="flex gap-2 text-xs leading-relaxed text-slate-700">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProsConsPitfalls({ pros, cons, pitfalls }: ProsConsPitfallsProps) {
  return (
    <section className="mt-4">
      <h2 className="text-sm font-semibold text-slate-900">优缺点与翻车案例</h2>
      <div className="mt-2 grid gap-3 md:grid-cols-3 print:grid-cols-3">
        <Column title="优点" items={pros} tone="pros" empty="暂无优点条目" />
        <Column title="缺点" items={cons} tone="cons" empty="暂无缺点条目" />
        <Column title="翻车案例" items={pitfalls} tone="pitfalls" empty="暂无翻车案例" />
      </div>
    </section>
  );
}
