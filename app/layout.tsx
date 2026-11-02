import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "机鉴 · 数码行情与避坑决策平台",
  description: "查行情 · 拍照验机 · AI 读评测 —— 一页报告告诉你这台机器买值不值、有没有坑。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
