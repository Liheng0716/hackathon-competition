"use client";

// 新机历史价折线：x=date, y=price，平滑 + 面积渐变 + tooltip，移动端高 240
import dynamic from "next/dynamic";
import type React from "react";
import { formatPrice } from "./format";

// echarts-for-react 只在浏览器侧加载，首屏不受 window 未定义影响
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

export type PricePoint = { date: string; price: number };

export default function PriceLineChart({
  data,
  modelName = "",
}: {
  data: PricePoint[];
  modelName?: string;
}) {
  const points = (data ?? []).filter((p) => Number.isFinite(p?.price));

  if (!points.length) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
        暂无历史价格
      </div>
    );
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = Math.max(20, Math.round((max - min) * 0.18));

  const option = {
    grid: { left: 8, right: 14, top: 28, bottom: 6, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: "#94a3b8", type: "dashed" } },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p) return "";
        return `<div style="font-size:11px;opacity:.7">${p.axisValue}</div>` +
          `<div style="margin-top:2px;font-weight:600">${formatPrice(p.data)}</div>` +
          (modelName ? `<div style="font-size:11px;opacity:.7">${modelName}</div>` : "");
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: points.map((p) => p.date),
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 10,
        hideOverlap: true,
        formatter: (v: string) => (typeof v === "string" ? v.slice(5) : v),
      },
    },
    yAxis: {
      type: "value",
      scale: true,
      min: min - pad,
      max: max + pad,
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLabel: { color: "#94a3b8", fontSize: 10, formatter: (v: number) => `¥${v}` },
    },
    series: [
      {
        name: "新机价",
        type: "line",
        smooth: true,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2.5, color: "#2563eb" },
        itemStyle: { color: "#2563eb" },
        emphasis: { focus: "series", scale: 1.6 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(37,99,235,0.30)" },
              { offset: 1, color: "rgba(37,99,235,0.02)" },
            ],
          },
        },
        data: prices,
        markPoint: {
          symbolSize: 44,
          label: { fontSize: 10, color: "#fff" },
          data: [
            { type: "min", name: "最低", itemStyle: { color: "#16a34a" }, label: { formatter: "低" } },
          ],
        },
      },
    ],
    animationDuration: 420,
  };

  return <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: "canvas" }} notMerge lazyUpdate />;
}
