// tools/seed-data.mjs —— 队长种子数据生成（确定性伪随机，可重跑覆盖）
// 产出：data/prices_current.json / data/prices_history.json / data/used_samples.json
// 说明：全部为演示用种子数据，source 标 seed/manual；接真实采集后由脚本覆盖。
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const DATA = join(ROOT, "data");
mkdirSync(DATA, { recursive: true });

const models = JSON.parse(readFileSync(join(DATA, "models.json"), "utf8"));
const NOW = new Date("2026-11-02T20:00:00+08:00");
const iso = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  const t = new Date(d.getTime() + 8 * 3600 * 1000); // 固定 +08:00 输出
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}+08:00`;
};
const day = (d) => iso(d).slice(0, 10);

// 线性同余，固定种子保证每次生成一致
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 折旧系数：按上市时间与档位估算（演示值，接真机数据后废弃）
const DISCOUNT = {
  "iphone-13-128g": 0.63, "iphone-14-pro-256g": 0.55, "mate-60-pro": 0.72,
  "xiaomi-14": 0.68, "redmi-k70": 0.66, "oneplus-ace-3": 0.65,
  "iphone-15-128g": 0.72, "iphone-12-64g": 0.45, "mate-60": 0.62,
  "nova-12": 0.63, "huawei-p60": 0.52, "honor-100": 0.6, "honor-x50": 0.58,
  "xiaomi-13": 0.55, "redmi-note-13-pro": 0.62, "oppo-reno-12": 0.66,
  "oneplus-ace-3v": 0.7, "vivo-s19": 0.67, "iqoo-neo9": 0.66, "samsung-s24": 0.6,
};

const current = {};
const history = {};
for (const m of models) {
  const base = Math.round(m.launch_price * (DISCOUNT[m.id] ?? 0.6) / 10) * 10 - 1; // 常见「xx99」尾数
  const r = rng(m.id.length * 7919 + m.launch_price);
  current[m.id] = {
    jd: base,
    captured_at: iso(NOW),
    source: "seed",
  };

  if (m.tier === 1) {
    // 30 天缓降 + 一次促销回落，用于折线图
    const pts = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(NOW.getTime() - i * 86400_000);
      let p = base + Math.round(i * (0.9 + r() * 1.2));
      if (i === 12) p -= 120; // 大促
      if (i === 11 || i === 13) p -= 60;
      pts.push({ date: day(d), price: Math.round(p / 5) * 5 - (i % 2) });
    }
    history[m.id] = pts;
  }
}

// 二手样本：6 款 T1 × 5 档 × 2~3 条
const GRADES = [
  { grade: "99新", cond: "99新 无使用痕迹 全套", f: 0.86 },
  { grade: "95新", cond: "95新 轻微使用痕迹 无划痕磕碰", f: 0.78 },
  { grade: "9成新", cond: "9成新 边框轻微划痕", f: 0.7 },
  { grade: "8成新", cond: "8成新 屏幕多处划痕 边框磕碰", f: 0.6 },
  { grade: "大修或功能缺陷", cond: "换过屏 电池已换 功能正常", f: 0.45 },
];
const samples = [];
let sid = 0;
for (const m of models.filter((x) => x.tier === 1)) {
  const anchor = current[m.id].jd;
  const r = rng(m.id.length * 104729 + 17);
  for (const g of GRADES) {
    const n = 2 + Math.floor(r() * 2); // 2~3 条
    for (let k = 0; k < n; k++) {
      const price = Math.round(anchor * g.f * (0.96 + r() * 0.1) / 10) * 10 - 1;
      const ago = Math.floor(r() * 14);
      samples.push({
        platform: "xianyu",
        model_id: m.id,
        title: `${m.keywords_xianyu} ${g.grade} 个人自用 可小刀`,
        price,
        condition_text: g.cond,
        grade: g.grade,
        link: `https://www.goofish.com/item?id=seed${(++sid).toString().padStart(4, "0")}`,
        captured_at: iso(new Date(NOW.getTime() - ago * 86400_000)),
      });
    }
  }
}

writeFileSync(join(DATA, "prices_current.json"), JSON.stringify(current, null, 2) + "\n");
writeFileSync(join(DATA, "prices_history.json"), JSON.stringify(history, null, 2) + "\n");
writeFileSync(join(DATA, "used_samples.json"), JSON.stringify(samples, null, 2) + "\n");

console.log(`seed ok: current=${Object.keys(current).length} history=${Object.keys(history).length} used=${samples.length}`);
