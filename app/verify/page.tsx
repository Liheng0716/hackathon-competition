"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import InspectCard from "@/components/verify/InspectCard";
import GridOverlay from "@/components/verify/GridOverlay";
import { DEMO_VERIFY, DEMO_VERIFY_RISKY } from "@/components/verify/demoVerify";
import { approxKb, compressImage, splitDataUrl } from "@/components/verify/imageTools";
import { guessModelSlug } from "@/components/verify/modelMatch";
import type { VerifyResult } from "@/components/verify/types";

type Phase = "idle" | "uploading" | "analyzing" | "done" | "error";

const PHASE_TEXT: Record<Phase, string> = {
  idle: "等待照片",
  uploading: "正在压缩上传…",
  analyzing: "AI 正在识机…",
  done: "识机完成",
  error: "识机失败",
};

function normalizeResult(raw: unknown): VerifyResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const defects = Array.isArray(obj.visible_defects) ? (obj.visible_defects as VerifyResult["visible_defects"]) : [];
  return {
    category: typeof obj.category === "string" ? obj.category : "手机",
    model_guess: typeof obj.model_guess === "string" ? obj.model_guess : "未识别机型",
    confidence: Number(obj.confidence) || 0,
    visible_defects: defects.filter((d) => d && typeof d === "object"),
    condition_score: Number(obj.condition_score) || 0,
    notes: typeof obj.notes === "string" ? obj.notes : "",
  };
}

async function callVerifyApi(base64: string): Promise<VerifyResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`识机接口 ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    if (json && typeof json === "object" && typeof json.error === "string" && json.error) {
      throw new Error(json.error);
    }
    if (!json || typeof json !== "object") throw new Error("识机接口返回空");
    return normalizeResult(json);
  } finally {
    clearTimeout(timer);
  }
}

export default function VerifyPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageKb, setImageKb] = useState<number>(0);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [failReason, setFailReason] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const match = useMemo(() => guessModelSlug(result?.model_guess), [result?.model_guess]);

  const reset = useCallback(() => {
    setPhase("idle");
    setImageUrl("");
    setImageKb(0);
    setResult(null);
    setIsDemo(false);
    setFailReason("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const useDemo = useCallback((risky = false) => {
    setResult(risky ? DEMO_VERIFY_RISKY : DEMO_VERIFY);
    setIsDemo(true);
    setFailReason("");
    setPhase("done");
  }, []);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setPhase("error");
        setFailReason("只支持图片文件（jpg / png / heic 转出的 jpg）");
        return;
      }
      setResult(null);
      setIsDemo(false);
      setFailReason("");
      setPhase("uploading");

      try {
        const dataUrl = await compressImage(file, 1280, 0.85);
        const { base64 } = splitDataUrl(dataUrl);
        setImageUrl(dataUrl);
        setImageKb(approxKb(base64));
        setPhase("analyzing");

        try {
          const payload = await callVerifyApi(base64);
          setResult(payload);
          setIsDemo(false);
          setPhase("done");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "识机接口不可用";
          setFailReason(msg);
          setResult(DEMO_VERIFY);
          setIsDemo(true);
          setPhase("done");
        }
      } catch (err) {
        setFailReason(err instanceof Error ? err.message : "图片处理失败");
        setPhase("error");
      }
    },
    [],
  );

  const busy = phase === "uploading" || phase === "analyzing";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6 print:pb-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">机鉴 · 拍照验机</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">拍一张，看清这台机器的成色</h1>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 no-print"
        >
          返回首页
        </Link>
      </header>

      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        对着机身正面拍一张（光线均匀、距屏幕 20-30cm），AI 会识别机型、给出成色分并标出可见瑕疵。
      </p>

      {/* 上传区 */}
      <section className="mt-5 no-print">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
          }}
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 text-center"
        >
          <p className="text-sm font-medium text-slate-700">
            状态：<span className="text-slate-900">{PHASE_TEXT[phase]}</span>
            {imageKb > 0 ? <span className="ml-2 text-[11px] text-slate-400">已上传 {imageKb} KB</span> : null}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {phase === "done" ? "换一张再验" : "拍照 / 选图"}
            </button>
            {phase === "done" || phase === "error" ? (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"
              >
                重置
              </button>
            ) : null}
            {phase === "idle" ? (
              <>
                <button
                  type="button"
                  onClick={() => useDemo(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600"
                >
                  没相机？看演示数据
                </button>
                <button
                  type="button"
                  onClick={() => useDemo(true)}
                  className="rounded-lg border border-amber-300 px-3 py-2 text-xs text-amber-700"
                >
                  演示：高风险样例
                </button>
              </>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            手机浏览器点「拍照 / 选图」会直接调起后摄；桌面端为文件选择。
          </p>
        </div>
      </section>

      {/* 错误 */}
      {phase === "error" ? (
        <section className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">这一步没过：{failReason}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              重新选图
            </button>
            <button
              type="button"
              onClick={() => useDemo(false)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700"
            >
              用演示数据继续
            </button>
          </div>
        </section>
      ) : null}

      {/* 处理中骨架 */}
      {busy ? (
        <section className="mt-5 animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="mt-3 h-6 w-40 rounded bg-slate-200" />
          <div className="mt-4 h-2 w-full rounded-full bg-slate-100" />
          <div className="mt-5 flex items-center gap-4">
            <div className="h-[180px] w-[180px] rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded bg-slate-100" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {phase === "uploading" ? "正在压缩图片…" : "AI 正在识机，通常 3-10 秒…"}
          </p>
        </section>
      ) : null}

      {/* 结果 */}
      {phase === "done" && result ? (
        <div className="mt-5 space-y-4">
          {isDemo ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 no-print">
              <p className="text-sm font-semibold text-amber-900">演示数据</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                {failReason ? `识机接口未就绪（${failReason}），当前展示内联兜底样例。` : "当前展示内联兜底样例，接口就绪后自动切换真实结果。"}
              </p>
            </div>
          ) : null}

          {imageUrl ? (
            <GridOverlay src={imageUrl} alt="待检照片" defects={result.visible_defects} />
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              演示模式未上传照片，九宫格标注需真实照片。
            </p>
          )}

          <InspectCard data={result} demo={isDemo} />
        </div>
      ) : null}

      {/* 右下角：生成估价 */}
      {phase === "done" && result ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur no-print">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="min-w-0 text-[11px] leading-tight text-slate-500">
              <span className={match.matched ? "text-slate-700" : "text-amber-700"}>{match.label}</span>
              <span className="mt-0.5 block text-slate-400">成色分 {Math.round(result.condition_score)} / 100</span>
            </p>
            <Link
              href={`/report/${match.id}`}
              className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              生成估价
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
