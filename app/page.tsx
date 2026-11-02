// 首页（泳道1A）：品牌 tab 筛选 + 机型卡片网格，T1 带「深度验机」角标
import Link from "next/link";
import models from "@/data/models.json";
import pricesCurrent from "@/data/prices_current.json";
import FreshnessBadge from "@/components/prices/FreshnessBadge";
import { formatPrice } from "@/components/prices/format";

type ModelRec = {
  id: string;
  brand: string;
  name: string;
  variant: string;
  tier: number;
  launch_price: number;
  jd_url: string;
  keywords_xianyu: string;
};

type CurrentRec = { jd: number; captured_at: string; source: string };

const MODEL_LIST = models as unknown as ModelRec[];
const CURRENT = pricesCurrent as unknown as Record<string, CurrentRec>;

const BRAND_ORDER = ["Apple", "华为", "荣耀", "小米", "Redmi", "OPPO", "一加", "vivo", "iQOO", "三星"];

export const metadata = {
  title: "机鉴 · 机型行情",
  description: "查新机历史价、二手五档成色价格与中位价，一页看懂这台机器现在买值不值。",
};

export default function HomePage({
  searchParams,
}: {
  searchParams?: { brand?: string };
}) {
  const rawBrand = searchParams?.brand ?? "";
  let activeBrand = BRAND_ORDER.includes(rawBrand) ? rawBrand : "全部";
  if (activeBrand === "全部" && rawBrand) {
    try {
      const decoded = decodeURIComponent(rawBrand);
      if (BRAND_ORDER.includes(decoded)) activeBrand = decoded;
    } catch {
      /* 非法转义，按全部处理 */
    }
  }

  const brands = [
    { key: "全部", count: MODEL_LIST.length },
    ...BRAND_ORDER.map((b) => ({
      key: b,
      count: MODEL_LIST.filter((m) => m.brand === b).length,
    })),
  ];

  const list = (activeBrand === "全部" ? MODEL_LIST : MODEL_LIST.filter((m) => m.brand === activeBrand))
    .slice()
    .sort((a, b) => a.tier - b.tier || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

  const t1Count = MODEL_LIST.filter((m) => m.tier === 1).length;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">机鉴</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          查行情 · 拍照验机 · AI 读评测 —— 一页报告告诉你这台机器买值不值、有没有坑。
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/verify"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            拍照验机
          </Link>
          <Link
            href="/prices/iphone-13-128g"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500"
          >
            看行情
          </Link>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          共 {MODEL_LIST.length} 款在库 · {t1Count} 款深度验机 · 数据均为静态 JSON，断网可渲染
        </p>
      </header>

      {/* 品牌 tab：移动端横向滚动 */}
      <nav className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {brands.map((b) => {
          const active = b.key === activeBrand;
          const href = b.key === "全部" ? "/" : `/?brand=${encodeURIComponent(b.key)}`;
          return (
            <Link
              key={b.key}
              href={href}
              scroll={false}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {b.key}
              <span className={`ml-1 text-[11px] ${active ? "text-slate-300" : "text-slate-400"}`}>
                {b.count}
              </span>
            </Link>
          );
        })}
      </nav>

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-slate-500">
          {activeBrand === "全部" ? "全部机型" : activeBrand} · {list.length} 款
        </h2>

        {list.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            该品牌暂无机型
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((m) => {
              const p = CURRENT[m.id];
              const isT1 = m.tier === 1;
              return (
                <li key={m.id}>
                  <Link
                    href={`/prices/${m.id}`}
                    className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-900 hover:shadow-sm"
                  >
                    {isT1 ? (
                      <span className="absolute right-3 top-3 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium leading-5 text-white">
                        深度验机
                      </span>
                    ) : null}
                    <div className="pr-16">
                      <div className="text-base font-semibold leading-tight text-slate-900">
                        {m.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {m.variant} · {m.brand} · 手机
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-2">
                      <div>
                        <div className="text-xl font-bold tabular-nums text-slate-900">
                          {p ? formatPrice(p.jd) : "—"}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {p ? "当前京东价" : "行情样本收集中"}
                        </div>
                      </div>
                      <span className="mb-0.5 shrink-0 text-[11px] text-slate-300 group-hover:text-slate-500">
                        看行情 →
                      </span>
                    </div>

                    {p ? (
                      <div className="mt-2">
                        <FreshnessBadge capturedAt={p.captured_at} />
                      </div>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-400">
        行情数据为采集合成样本，仅供决策参考；五档成色口径：99新 / 95新 / 9成新 / 8成新 / 大修或功能缺陷。
      </footer>
    </main>
  );
}
