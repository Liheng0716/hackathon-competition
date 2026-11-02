// 首页占位（队长初始化）；泳道1A 接管后替换为品牌筛选 + 机型卡片
import Link from "next/link";
import models from "@/data/models.json";

export default function HomePage() {
  const list = models as { id: string; name: string; variant: string; brand: string }[];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">机鉴</h1>
      <p className="mt-2 text-slate-600">
        查行情 · 拍照验机 · AI 读评测 —— 一页报告告诉你这台机器买值不值、有没有坑。
      </p>

      <div className="mt-6 flex gap-3">
        <Link href="/verify" className="rounded-lg bg-slate-900 px-4 py-2 text-white">拍照验机</Link>
        <Link href="/prices/iphone-13-128g" className="rounded-lg border border-slate-300 px-4 py-2">看行情</Link>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-slate-500">机型（{list.length}）</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {list.map((m) => (
          <li key={m.id}>
            <Link href={`/prices/${m.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
              <div className="font-medium">{m.name} {m.variant}</div>
              <div className="mt-1 text-xs text-slate-500">{m.brand}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
