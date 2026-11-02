import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import modelsJson from "@/data/models.json";
import VerdictCard from "@/components/report/VerdictCard";
import PricePosition from "@/components/report/PricePosition";
import ProsConsPitfalls from "@/components/report/ProsConsPitfalls";
import SourceList from "@/components/report/SourceList";
import UpdatedAgo from "@/components/report/UpdatedAgo";
import PrintButton from "@/components/report/PrintButton";
import { normalizeReport, type Report } from "@/components/report/types";
import { DEMO_REPORT } from "@/components/report/demoReport";
import { FALLBACK_MODEL_ID } from "@/components/verify/modelMatch";

export const dynamic = "force-dynamic";

type ModelRow = { id: string; brand: string; name: string; variant: string };

const MODELS = modelsJson as ModelRow[];

const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

async function loadReportFile(modelId: string): Promise<{ report: Report | null; reason?: string }> {
  if (!SAFE_ID.test(modelId)) return { report: null, reason: "机型参数非法" };
  const file = path.join(process.cwd(), "data", "reports", `${modelId}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return { report: null, reason: "报告文件还没生成" };
  }
  try {
    const report = normalizeReport(JSON.parse(raw));
    return report ? { report } : { report: null, reason: "报告格式不完整" };
  } catch {
    return { report: null, reason: "报告文件解析失败" };
  }
}

function titleOf(modelId: string): { title: string; known: boolean } {
  const row = MODELS.find((m) => m.id === modelId);
  return row ? { title: `${row.name} ${row.variant}`, known: true } : { title: modelId, known: false };
}

export async function generateMetadata({ params }: { params: { model: string } }): Promise<Metadata> {
  const { title } = titleOf(params.model);
  return { title: `${title} · 决策报告 · 机鉴` };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { model: string };
  searchParams?: { demo?: string };
}) {
  const modelId = params.model;
  const { title, known } = titleOf(modelId);
  const { report: fileReport, reason } = await loadReportFile(modelId);

  const wantDemo = searchParams?.demo === "1";
  const isDemo = !fileReport && wantDemo;
  const report: Report | null = fileReport ?? (isDemo ? DEMO_REPORT : null);

  if (!report) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-4xl">⏳</p>
          <h1 className="mt-3 text-xl font-bold tracking-tight">报告生成中，稍后再来</h1>
          <p className="mt-2 text-sm text-slate-600">
            {title}
            {known ? "" : "（这个机型不在当前 20 款目录里）"}
            {reason ? ` · ${reason}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-400">AI 正在汇总评测、闲鱼成交与翻车案例，通常几分钟内生成。</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              返回首页
            </Link>
            <Link
              href={`/prices/${known ? modelId : FALLBACK_MODEL_ID}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              先看行情
            </Link>
            <Link
              href={`?demo=1`}
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700"
            >
              查看演示报告
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const styleKey = report.verdict ?? "wait";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
      {isDemo ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 no-print">
          <p className="text-sm font-semibold text-amber-900">演示数据</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
            data/reports/{modelId}.json 还没产出，当前展示内联演示报告；文件落地后本页自动切换真实数据。
          </p>
        </div>
      ) : null}

      <header className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">机鉴 · 决策报告</p>
          <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <PrintButton />
      </header>

      <VerdictCard verdict={String(styleKey)} reason={report.verdict_reason} modelName={title} demo={isDemo} />

      <PricePosition text={report.price_position} />

      <ProsConsPitfalls pros={report.pros} cons={report.cons} pitfalls={report.pitfalls} />

      <SourceList sources={report.sources} />

      <UpdatedAgo generatedAt={report.generated_at} />

      <nav className="mt-5 flex flex-wrap gap-2 no-print">
        <Link
          href={`/prices/${known ? modelId : FALLBACK_MODEL_ID}`}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          看行情详情
        </Link>
        <Link href="/verify" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">
          再验一台
        </Link>
        <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">
          返回首页
        </Link>
      </nav>
    </main>
  );
}
