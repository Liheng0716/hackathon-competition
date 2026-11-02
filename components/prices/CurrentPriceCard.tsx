// 当前价卡：价格大字 + source 标签 + 数据龄徽章 + 去京东外链
import FreshnessBadge from "./FreshnessBadge";
import { formatPrice } from "./format";

export type ModelRec = {
  id: string;
  brand: string;
  name: string;
  variant: string;
  tier: number;
  launch_price: number;
  jd_url: string;
  keywords_xianyu: string;
};

export type CurrentPriceRec = {
  jd: number;
  captured_at: string;
  source: string;
};

const SOURCE_LABEL: Record<string, string> = {
  seed: "种子数据",
  manual: "人工采集",
  union_api: "联盟接口",
};

function sourceLabel(s?: string) {
  if (!s) return "未知来源";
  return SOURCE_LABEL[s] ?? s;
}

export default function CurrentPriceCard({
  model,
  price,
}: {
  model: ModelRec;
  price?: CurrentPriceRec | null;
}) {
  const hasPrice = !!price && Number.isFinite(price.jd);
  const diff = hasPrice && model.launch_price ? price!.jd - model.launch_price : 0;
  const diffPct = hasPrice && model.launch_price ? Math.round((diff / model.launch_price) * 100) : 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">当前京东价</div>
          <div className="mt-1 text-4xl font-bold tracking-tight tabular-nums text-slate-900">
            {hasPrice ? formatPrice(price!.jd) : "—"}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
          {sourceLabel(price?.source)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FreshnessBadge capturedAt={price?.captured_at} />
        {hasPrice && model.launch_price ? (
          <span className="text-[11px] text-slate-500">
            首发 {formatPrice(model.launch_price)} · 累计
            <span className={diff < 0 ? " text-emerald-600" : " text-slate-700"}>
              {" "}
              {diff < 0 ? "降" : "涨"} {Math.abs(diffPct)}%
            </span>
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <a
          href={model.jd_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-slate-700"
        >
          去京东
        </a>
        <a
          href={`https://www.goofish.com/search?q=${encodeURIComponent(model.keywords_xianyu)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:border-slate-500"
        >
          搜闲鱼二手
        </a>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        数据来源：{sourceLabel(price?.source)} · 采样 {model.id}
      </p>
    </section>
  );
}
