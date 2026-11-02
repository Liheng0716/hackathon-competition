import { formatDateTime, hoursAgo } from "./format";

export type UpdatedAgoProps = { generatedAt?: string };

export default function UpdatedAgo({ generatedAt }: UpdatedAgoProps) {
  const ago = hoursAgo(generatedAt);
  return (
    <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
      <span>
        数据更新于 <span className="font-medium text-slate-700">{ago.text}</span>
        {ago.isSeed ? null : generatedAt ? <span className="ml-2 text-slate-400">{formatDateTime(generatedAt)}</span> : null}
      </span>
      <span className="text-slate-400">机鉴 · 报告由 AI 汇总公开信息生成，交易前请自行复核</span>
    </footer>
  );
}
