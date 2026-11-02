"use client";

// 二手散点：x=采集时间, y=价格，按五档成色着色，叠加中位价 markLine
import dynamic from "next/dynamic";
import type React from "react";
import { dateTime, formatPrice } from "./format";

type ChartProps = {
  option: any;
  style?: React.CSSProperties;
  className?: string;
  opts?: any;
  notMerge?: boolean;
  lazyUpdate?: boolean;
};

const ReactECharts = dynamic(() => import("echarts-for-react") as any, {
  ssr: false,
  loading: () => <div className="h-[240px] w-full animate-pulse rounded-lg bg-slate-100" />,
}) as unknown as React.ComponentType<ChartProps>;

export type UsedSample = {
  platform: string;
  model_id: string;
  title: string;
  price: number;
  condition_text: string;
  grade: string;
  link: string;
  captured_at: string;
};

/** 五档唯一口径配色 */
export const GRADE_COLORS: Record<string, string> = {
  "99新": "#16a34a",
  "95新": "#2563eb",
  "9成新": "#eab308",
  "8成新": "#f97316",
  "大修": "#dc2626",
  "大修或功能缺陷": "#dc2626",
};

export const GRADE_ORDER = ["99新", "95新", "9成新", "8成新", "大修或功能缺陷"];

export default function UsedScatter({
  samples,
  medianPrice,
}: {
  samples: UsedSample[];
  medianPrice: number;
}) {
  const rows = (samples ?? []).filter(
    (s) => Number.isFinite(s?.price) && !Number.isNaN(Date.parse(s?.captured_at ?? ""))
  );

  if (!rows.length) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
        暂无二手样本
      </div>
    );
  }

  const grades = GRADE_ORDER.filter((g) => rows.some((r) => r.grade === g));
  const extra = Array.from(new Set(rows.map((r) => r.grade))).filter((g) => !GRADE_ORDER.includes(g));

  const series = [...grades, ...extra].map((grade, i) => ({
    name: grade,
    type: "scatter",
    symbolSize: 11,
    itemStyle: {
      color: GRADE_COLORS[grade] ?? "#64748b",
      opacity: 0.85,
      borderColor: "#fff",
      borderWidth: 1,
    },
    emphasis: { scale: 1.5, itemStyle: { opacity: 1 } },
    data: rows
      .filter((r) => r.grade === grade)
      .map((r) => ({
        value: [Date.parse(r.captured_at), r.price],
        name: r.title,
        grade: r.grade,
        platform: r.platform,
        condition: r.condition_text,
        link: r.link,
        captured_at: r.captured_at,
      })),
    ...(i === 0
      ? {
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#0f172a", type: "dashed", width: 1.2 },
            label: {
              formatter: `中位价 ${formatPrice(medianPrice)}`,
              position: "insideEndTop",
              color: "#0f172a",
              fontSize: 10,
              backgroundColor: "rgba(255,255,255,0.85)",
              padding: [2, 4],
            },
            data: [{ yAxis: medianPrice }],
          },
        }
      : {}),
  }));

  const option = {
    grid: { left: 8, right: 16, top: 42, bottom: 6, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 9,
      itemHeight: 9,
      itemGap: 10,
      icon: "circle",
      textStyle: { fontSize: 11, color: "#475569" },
      data: series.map((s) => s.name),
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 12 },
      formatter: (p: any) => {
        const d = p?.data ?? {};
        return (
          `<div style="max-width:220px;white-space:normal;font-weight:600">${d.name ?? ""}</div>` +
          `<div style="margin-top:3px">${formatPrice(d.value?.[1])} · ${d.grade ?? ""}</div>` +
          `<div style="font-size:11px;opacity:.7">${d.condition ?? ""}</div>` +
          `<div style="font-size:11px;opacity:.7">${d.platform ?? ""} · ${dateTime(d.captured_at)}</div>`
        );
      },
    },
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 10,
        hideOverlap: true,
        formatter: (v: number) => {
          const d = new Date(v);
          const p = (x: number) => String(x).padStart(2, "0");
          return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        },
      },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLabel: { color: "#94a3b8", fontSize: 10, formatter: (v: number) => `¥${v}` },
    },
    series,
    animationDuration: 380,
  };

  return <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: "canvas" }} notMerge lazyUpdate />;
}
