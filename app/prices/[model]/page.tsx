// 行情详情页（泳道1A）：T1 三件套（折线 / 现价卡 / 二手散点）、T2 现价卡+报告入口、T3 样本收集中
import Link from "next/link";
import { notFound } from "next/navigation";
import models from "@/data/models.json";
import pricesCurrent from "@/data/prices_current.json";
import pricesHistory from "@/data/prices_history.json";
import usedSamples from "@/data/used_samples.json";

import CurrentPriceCard, {
  type CurrentPriceRec,
  type ModelRec,
} from "@/components/prices/CurrentPriceCard";
import PriceLineChart, { type PricePoint } from "@/components/prices/PriceLineChart";
import UsedScatter, { type UsedSample } from "@/components/prices/UsedScatter";
import { formatPrice, median, shortDate, dateTime } from "@/components/prices/format";

const MODEL_LIST = models as unknown as ModelRec[];
const CURRENT = pricesCurrent as unknown as Record<string, CurrentPriceRec>;
const HISTORY = pricesHistory as unknown as Record<string, PricePoint[]>;
const USED = usedSamples as unknown as UsedSample[];

export function generateStaticParams() {
  return MODEL_LIST.map((m) => ({ model: m.id }));
}

export function generateMetadata({ params }: { params: { model: string } }) {
  const m = MODEL_LIST.find((x) => x.id === params.model);
  if (!m) return { title: "机型不存在 · 机鉴" };
  return {
    title: `${m.name} ${m.variant} 行情 · 机鉴`,
    description: `${m.name} ${m.variant} 新机历史价走势、二手五档成色价格与中位价。`,
  };
}

const TIER_LABEL: Record<number, string> = {
  1: "深度验机",
  2: "行情机型",
  3: "目录机型",
};

export default function PriceDetailPage({ params }: { params: { model: string } }) {
  const model = MODEL_LIST.find((m) => m.id === params.model);
  if (!model) notFound();

  const price = CURRENT[model.id] ?? null;
  const history = (HISTORY[model.id] ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const samples = USED.filter((s) => s.model_id === model.id);
  const prices = samples.map((s) => s.price);
  const mid = median(prices);
  const low = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 0;

  const trend =
    history.length > 1 ? history[history.length - 1].price - history[0].price : 0;

  const isT1 = model.tier === 1;
  const isT3 = model.tier === 3;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← 全部机型
      </Link>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {model.name} {model.variant}
          </h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {model.brand}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isT1 ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-500"
            }`}
          >
            {TIER_LABEL[model.tier] ?? "机型"}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          品类 手机 · 首发 {formatPrice(model.launch_price)}
          {history.length > 1 ? (
            <>
              {" "}
              · 近 {history.length} 天{" "}
              <span className={trend < 0 ? "text-emerald-600" : "text-slate-700"}>
                {trend < 0 ? "降" : "涨"} {formatPrice(Math.abs(trend))}
              </span>
            </>
          ) : null}
        </p>
      </header>

      {isT3 ? (
        <section className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <div className="text-base font-semibold text-amber-800">行情样本收集中</div>
          <p className="mt-2 text-sm text-amber-700">
            这款机型已进目录，尚未采集到可靠的新机价与二手样本，暂不提供走势图。
          </p>
        </section>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {isT1 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">新机历史价走势</h2>
                  <span className="text-[11px] text-slate-400">
                    {history.length ? `${shortDate(history[0].date)} → ${shortDate(history[history.length - 1].date)}` : ""}
                  </span>
                </div>
                <PriceLineChart data={history} modelName={`${model.name} ${model.variant}`} />
              </section>
            ) : null}

            {isT1 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">二手价格带（按成色）</h2>
                  <span className="text-[11px] text-slate-400">{samples.length} 条样本</span>
                </div>
                <UsedScatter samples={samples} medianPrice={mid} />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 py-2">
                    <div className="text-[11px] text-slate-500">最低</div>
                    <div className="text-sm font-semibold tabular-nums">{low ? formatPrice(low) : "—"}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2">
                    <div className="text-[11px] text-slate-500">中位</div>
                    <div className="text-sm font-semibold tabular-nums">{mid ? formatPrice(mid) : "—"}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2">
                    <div className="text-[11px] text-slate-500">最高</div>
                    <div className="text-sm font-semibold tabular-nums">{high ? formatPrice(high) : "—"}</div>
                  </div>
                </div>
              </section>
            ) : null}

            {!isT1 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-700">机型行情</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  该机型为 T2 行情机型：提供当前京东价与成色估价入口，暂不提供 30 天走势与二手散点。
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] text-slate-500">当前京东价</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">
                      {price ? formatPrice(price.jd) : "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] text-slate-500">发行价</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{formatPrice(model.launch_price)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/report/${model.id}`}
                    className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    看 AI 报告
                  </Link>
                  <Link
                    href={`/verify?model=${model.id}`}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:border-slate-500"
                  >
                    拍照验机估价
                  </Link>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            <CurrentPriceCard model={model} price={price} />

            {isT1 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-700">这台值不值？</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  二手中位价 {mid ? formatPrice(mid) : "—"}，对比当前京东价
                  {price ? ` ${formatPrice(price.jd)}` : ""}
                  {mid && price ? `，二手折价约 ${Math.round(((price.jd - mid) / price.jd) * 100)}%` : ""}。
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    href={`/verify?model=${model.id}`}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    拍照验机 · 估成色
                  </Link>
                  <Link
                    href={`/report/${model.id}`}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:border-slate-500"
                  >
                    看 AI 报告
                  </Link>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  最新样本 {samples.length ? dateTime(samples[samples.length - 1].captured_at) : "—"}
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      )}

      {isT1 && samples.length ? (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">最近二手挂牌</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {samples
              .slice()
              .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at))
              .slice(0, 6)
              .map((s, i) => (
                <li key={`${s.link}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-slate-700 hover:text-slate-900 hover:underline"
                      title={s.title}
                    >
                      {s.title}
                    </a>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {s.grade} · {s.condition_text} · {shortDate(s.captured_at)}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(s.price)}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
