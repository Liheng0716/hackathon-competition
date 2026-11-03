import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import DecisionCard from "@/components/report/DecisionCard";
import PricePositionBar from "@/components/report/PricePositionBar";
import ThreeColumns from "@/components/report/ThreeColumns";
import SourceList from "@/components/report/SourceList";
import { type ReportData, normalizePricePosition } from "@/components/report/types";

interface ModelMeta {
  id: string;
  brand: string;
  name: string;
  variant: string;
}

async function readJson<T>(rel: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), rel), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadReport(model: string): Promise<ReportData | null> {
  // 路由参数会拼进文件路径，白名单校验防路径穿越
  if (!/^[a-z0-9-]+$/i.test(model)) return null;
  // data/reports/** 属 E 泳道（真数据），优先读取
  const real = await readJson<ReportData>(path.join("data", "reports", `${model}.json`));
  if (real) return real;
  // 真数据未生成前，回落到泳道1B 自带的演示样例（不写 data/reports，避免目录越界）
  return readJson<ReportData>(
    path.join("components", "report", "mock", `${model}.json`),
  );
}

/** 报告契约不含机型名，从 models.json 补一个展示名（缺失则回落 model_id） */
async function loadModelMeta(model: string): Promise<ModelMeta | null> {
  const models = await readJson<ModelMeta[]>(path.join("data", "models.json"));
  if (!Array.isArray(models)) return null;
  return models.find((m) => m.id === model) ?? null;
}

export default async function ReportPage({
  params,
}: {
  params: { model: string };
}) {
  const report = await loadReport(params.model);

  if (!report) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">报告生成中</h1>
        <p className="mt-2 text-sm text-slate-500">
          该机型的决策报告正在生成，稍后再来。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-blue-600 hover:underline"
        >
          返回首页
        </Link>
      </main>
    );
  }

  const meta = await loadModelMeta(params.model);
  const display: ReportData = {
    ...report,
    model_name:
      report.model_name ?? (meta ? `${meta.name} ${meta.variant}`.trim() : undefined),
  };

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 print:space-y-2">
      <DecisionCard report={display} />
      <PricePositionBar position={normalizePricePosition(report.price_position)} />
      <ThreeColumns
        pros={report.pros ?? []}
        cons={report.cons ?? []}
        pitfalls={report.pitfalls ?? []}
      />
      <SourceList sources={report.sources ?? []} />

      <footer className="no-print pt-4 text-center text-xs text-slate-400">
        机鉴 · 数据仅供决策参考 · 生成于{" "}
        {report.generated_at
          ? new Date(report.generated_at).toLocaleString("zh-CN")
          : report.model_id}
      </footer>
    </main>
  );
}
