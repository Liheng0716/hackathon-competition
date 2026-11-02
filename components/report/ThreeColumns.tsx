import { type Pitfall, pitfallText } from "./types";

interface ThreeColumnsProps {
  pros: string[];
  cons: string[];
  pitfalls: Pitfall[];
}

function ListCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className={`mb-3 text-sm font-semibold ${accent}`}>{title}</h3>
      {children}
    </div>
  );
}

export default function ThreeColumns({
  pros,
  cons,
  pitfalls,
}: ThreeColumnsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <ListCard title="优点" accent="text-green-600">
        <ul className="space-y-2 text-sm text-slate-700">
          {pros.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-green-500">+</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </ListCard>

      <ListCard title="缺点" accent="text-red-600">
        <ul className="space-y-2 text-sm text-slate-700">
          {cons.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-red-500">-</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </ListCard>

      <ListCard title="翻车案例" accent="text-orange-600">
        <ul className="space-y-3 text-sm">
          {pitfalls.length === 0 && (
            <li className="text-slate-400">暂未收录案例</li>
          )}
          {pitfalls.map((p, i) => {
            const { title, detail } = pitfallText(p);
            return (
              <li key={i}>
                <div className="font-medium text-slate-800">{title}</div>
                {detail && (
                  <div className="text-xs leading-relaxed text-slate-500">
                    {detail}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </ListCard>
    </section>
  );
}
