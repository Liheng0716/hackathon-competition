import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 五档成色统一色板（行情散点 / 验机卡共用）
        grade: {
          99: "#16a34a",
          95: "#2563eb",
          g9: "#eab308",
          g8: "#f97316",
          bad: "#dc2626",
        },
        verdict: { buy: "#16a34a", wait: "#eab308", avoid: "#dc2626" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
