"use client";

// 数据龄徽章：更新于 x 分钟/小时/天前；>48h 黄色警示，>7 天红色
import { useEffect, useState } from "react";
import { relativeTime, type FreshLevel } from "./format";

const STYLE: Record<FreshLevel, string> = {
  fresh: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-300",
  stale: "bg-red-50 text-red-700 border-red-300",
  unknown: "bg-slate-50 text-slate-500 border-slate-200",
};

const DOT: Record<FreshLevel, string> = {
  fresh: "bg-emerald-500",
  warn: "bg-amber-500",
  stale: "bg-red-500",
  unknown: "bg-slate-400",
};

export default function FreshnessBadge({
  capturedAt,
  className = "",
}: {
  capturedAt?: string;
  className?: string;
}) {
  // 服务端预渲染用构建时刻，挂载后按浏览器时间刷新，避免水合报错
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { text, level } = relativeTime(capturedAt, now);

  return (
    <span
      suppressHydrationWarning
      title={capturedAt ?? ""}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 ${STYLE[level]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[level]}`} />
      {text}
    </span>
  );
}
