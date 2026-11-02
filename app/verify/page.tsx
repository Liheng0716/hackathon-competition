"use client";

import { useRef, useState } from "react";
import InspectCard from "@/components/verify/InspectCard";
import GridOverlay from "@/components/verify/GridOverlay";
import type { VerifyResult } from "@/components/verify/types";

type Status = "idle" | "uploading" | "analyzing" | "done" | "error";

/** API 未接入时的 mock 结果（结构见 docs/README-dev.md 识机 JSON 契约） */
const MOCK_RESULT: VerifyResult = {
  category: "手机",
  model_guess: "iPhone 13",
  confidence: 86,
  visible_defects: [
    { area: "屏幕", type: "划痕", severity: "轻微", detail: "右下角细划" },
    { area: "下右", type: "磕碰", severity: "中等", detail: "边框一处磕碰" },
    { area: "镜头", type: "污渍", severity: "轻微", detail: "镜头轻微污渍" },
  ],
  condition_score: 85,
  notes: "整体良好，边框有轻微磨损，建议核实是否拆修。",
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function VerifyPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
    void analyze(file);
  }

  async function analyze(file: File) {
    setStatus("uploading");
    try {
      // 契约：POST /api/verify，body 为 JSON { image: "data:image/...base64" }
      const image = await fileToDataUrl(file);
      setStatus("analyzing");
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // 契约里非数码产品返回 {"error":"not_product"}
      if (data?.error) {
        setStatus("error");
        setErrorMsg(
          data.error === "not_product"
            ? "这张照片看起来不是数码产品，请换一张实物照片。"
            : `识机失败：${data.error}`,
        );
        return;
      }
      if (!data || !data.model_guess) throw new Error("invalid payload");

      setResult(data as VerifyResult);
      setIsMock(false);
      setStatus("done");
    } catch {
      // API 未就绪 → 回落 mock，保证前端可独立开发
      setResult(MOCK_RESULT);
      setIsMock(true);
      setStatus("done");
      setErrorMsg("识机 API 暂不可用，已展示演示数据");
    }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setResult(null);
    setIsMock(false);
    setErrorMsg(null);
    setStatus("idle");
  }

  const busy = status === "uploading" || status === "analyzing";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">拍照验机</h1>
        <p className="mt-1 text-sm text-slate-500">
          拍一张实物照片，AI 帮你识别机型、评估成色、标出瑕疵。
        </p>
      </header>

      {/* 上传 / 拍照 */}
      <div className="flex flex-wrap gap-3">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraInputRef.current?.click()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          拍照验机
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        >
          从相册选择
        </button>
        {(preview || result) && !busy && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-800"
          >
            重新开始
          </button>
        )}
      </div>

      {/* 状态提示 */}
      {busy && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
          {status === "uploading" ? "照片上传中…" : "AI 分析中…"}
        </div>
      )}
      {errorMsg && status !== "done" && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </p>
      )}
      {errorMsg && status === "done" && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {errorMsg}
        </p>
      )}

      {/* 照片 + 九宫格覆盖 */}
      {preview && (
        <div className="mt-6">
          <GridOverlay imageUrl={preview} defects={result?.visible_defects ?? []} />
        </div>
      )}

      {/* 验机卡 */}
      {status === "done" && result && (
        <div className="mt-6">
          <InspectCard result={result} isMock={isMock} />
          <div className="no-print mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              导出/打印验机卡
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
