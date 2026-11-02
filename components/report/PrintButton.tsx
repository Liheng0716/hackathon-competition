"use client";

export default function PrintButton({ label = "打印 / 存 PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-400"
    >
      {label}
    </button>
  );
}
