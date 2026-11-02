"use client";

import { useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  type VerifyResult,
  conditionGrade,
  guessModelId,
  severityStyle,
} from "./types";

interface InspectCardProps {
  result: VerifyResult;
  /** 是否使用 mock 数据（API 未就绪时） */
  isMock?: boolean;
}

export default function InspectCard({ result, isMock }: InspectCardProps) {
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<string | null>(null);

  const gaugeOption: EChartsOption = {
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
          itemStyle: {
            color:
              result.condition_score >= 85
                ? "#16a34a"
                : result.condition_score >= 70
                  ? "#f59e0b"
                  : "#dc2626",
          },
        },
        axisLine: { lineStyle: { width: 12, color: [[1, "#e2e8f0"]] } },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, 0],
          fontSize: 30,
          fontWeight: "bold",
          formatter: "{value}",
          color: "#0f172a",
        },
        title: {
          offsetCenter: [0, "42%"],
          fontSize: 12,
          color: "#64748b",
        },
        data: [
          {
            value: result.condition_score,
            name: conditionGrade(result.condition_score),
          },
        ],
      },
    ],
  };

  async function handleEstimate() {
    setEstimating(true);
    setEstimate(null);
    // 契约：POST /api/estimate { model_id, grade, answers } → { low, mid, high, basis[] }
    // 验机卡只有成色分，answers 暂空（完整问卷版后续接）
    const grade = conditionGrade(result.condition_score);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: guessModelId(result.model_guess),
          grade,
          answers: {},
        }),
      });
      if (!res.ok) throw new Error("estimate api not ready");
      const data = await res.json();
      if (data?.error) throw new Error(String(data.error));
      const { low, mid, high } = data ?? {};
      setEstimate(
        low != null && high != null
          ? `估价区间 ¥${low}${mid != null ? ` · 中位 ¥${mid}` : ""} ~ ¥${high}`
          : `估价结果：${JSON.stringify(data)}`,
      );
    } catch {
      setEstimate("估价通道未就绪（泳道2 API 待接入）");
    } finally {
      setEstimating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {isMock && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          演示数据：识机 API 未接入，当前为 mock 结果
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-slate-900">
          {result.model_guess || "未知机型"}
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {result.category}
        </span>
      </div>

      {/* 置信度进度条 */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>机型识别置信度</span>
          <span className="font-semibold text-slate-700">
            {result.confidence}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, result.confidence))}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[180px_1fr]">
        {/* 成色分环形图 */}
        <div>
          <ReactECharts
            option={gaugeOption}
            style={{ height: 180, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
          <p className="mt-1 text-center text-xs text-slate-400">成色分（0-100）</p>
        </div>

        {/* 瑕疵列表 */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            可见瑕疵（{result.visible_defects.length}）
          </h3>
          {result.visible_defects.length === 0 ? (
            <p className="text-sm text-slate-400">未检测到明显瑕疵</p>
          ) : (
            <ul className="space-y-2">
              {result.visible_defects.map((d, i) => {
                const s = severityStyle(d.severity);
                return (
                  <li
                    key={`${d.area}-${d.type}-${i}`}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                    <span className="text-slate-500">{d.area}</span>
                    <span className="text-slate-800">{d.type}</span>
                    <span
                      className={`ml-1 rounded border px-1.5 py-0.5 text-[10px] ${s.badge}`}
                    >
                      {d.severity}
                    </span>
                    {d.detail && (
                      <span className="text-xs text-slate-400">{d.detail}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {result.notes && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-700">翻新风险提示：</span>
              {result.notes}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {estimate && (
          <span className="text-sm font-medium text-slate-700">{estimate}</span>
        )}
        <button
          type="button"
          onClick={handleEstimate}
          disabled={estimating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {estimating ? "估价中…" : "生成估价"}
        </button>
      </div>
    </div>
  );
}
