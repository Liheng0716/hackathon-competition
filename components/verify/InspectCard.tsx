"use client";

import dynamic from "next/dynamic";
import type { VerifyResult } from "./types";
import { SEVERITY_STYLE, clampPercent, renovationRisk, scoreColor, scoreLabel, sevKey } from "./format";

const ReactECharts = dynamic(() => import("echarts-for-react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-[180px] w-[180px] animate-pulse rounded-full bg-slate-100" />,
});

export type InspectCardProps = {
  data: VerifyResult;
  demo?: boolean;
  className?: string;
};

function gaugeOption(score: number) {
  const color = scoreColor(score);
  return {
    animationDuration: 600,
    series: [
      {
        type: "gauge",
        startAngle: 90,
        endAngle: -270,
        radius: "92%",
        center: ["50%", "50%"],
        pointer: { show: false },
        progress: {
          show: true,
          overlap: false,
          roundCap: true,
          clip: false,
          itemStyle: { color },
        },
        axisLine: { lineStyle: { width: 12, color: [[1, "#e2e8f0"]] } },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "0%"],
          formatter: (v: number) => String(Math.round(v)),
          fontSize: 34,
          fontWeight: 700,
          color,
        },
        data: [{ value: Math.max(0, Math.min(100, Math.round(score))) }],
      },
    ],
  };
}

export default function InspectCard({ data, demo = false, className = "" }: InspectCardProps) {
  const conf = clampPercent(Number(data.confidence) || 0);
  const score = Math.max(0, Math.min(100, Math.round(Number(data.condition_score) || 0)));
  const defects = Array.isArray(data.visible_defects) ? data.visible_defects : [];
  const risk = renovationRisk(score, data.notes);

  const counts = { 轻微: 0, 中等: 0, 严重: 0 };
  for (const d of defects) counts[sevKey(d.severity)] += 1;

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{data.category ?? "手机"} · AI 识机结果</p>
          <h2 className="mt-0.5 truncate text-xl font-bold tracking-tight">{data.model_guess}</h2>
        </div>
        {demo ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800">
            演示数据
          </span>
        ) : null}
      </header>

      {/* 置信度 */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-500">识机置信度</span>
          <span className="font-semibold tabular-nums text-slate-900">{conf}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-2 rounded-full bg-slate-900 transition-all duration-500"
            style={{ width: `${conf}%` }}
          />
        </div>
      </div>

      {/* 成色分环形图 */}
      <div className="mt-5 flex items-center gap-4">
        <div className="h-[180px] w-[180px] shrink-0">
          <ReactECharts option={gaugeOption(score)} style={{ height: 180, width: 180 }} opts={{ renderer: "svg" }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">成色分（0-100）</p>
          <p className="mt-1 text-sm font-semibold" style={{ color: scoreColor(score) }}>
            {scoreLabel(score)}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            瑕疵 {defects.length} 处
            <br />
            轻微 {counts.轻微} · 中等 {counts.中等} · 严重 {counts.严重}
          </p>
        </div>
      </div>

      {/* 翻新风险 */}
      {risk.risky ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">翻新 / 维修风险提示</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
            触发条件：{risk.reasons.join("；")}。当面交易时请核对序列号、拆机痕迹与屏幕原彩，必要时按「大修」档议价。
          </p>
        </div>
      ) : null}

      {/* 瑕疵列表 */}
      <h3 className="mt-5 text-sm font-semibold text-slate-900">可见瑕疵</h3>
      {defects.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">未检出明显瑕疵。</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {defects.map((d, i) => {
            const style = SEVERITY_STYLE[sevKey(d.severity)];
            return (
              <li
                key={`${d.area}-${d.type}-${i}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {d.area} · {d.type}
                  </p>
                  {d.detail ? (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{d.detail}</p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.badge}`}
                >
                  {sevKey(d.severity)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {data.notes ? (
        <div className="mt-4 rounded-xl bg-slate-900/[0.03] p-3">
          <p className="text-[11px] font-semibold text-slate-500">AI 备注</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-700">{data.notes}</p>
        </div>
      ) : null}
    </section>
  );
}
