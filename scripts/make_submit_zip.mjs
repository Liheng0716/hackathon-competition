// scripts/make_submit_zip.mjs —— 生成 AI Works 上传包（自动排除 node_modules/.env/.next 等）
// 用法：pnpm submit  →  产出 jiijian-submit-<日期>.zip
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";

const EXCLUDE_DIRS = new Set([
  "node_modules", ".next", ".git", ".npm-cache", ".tmp-swc", "__pycache__", "logs", "out",
]);
const EXCLUDE_FILES = [/^\.env$/, /^\.env\.local$/, /^.*\.log$/, /^jiijian-submit-.*\.zip$/];

const date = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const out = `jiijian-submit-${date}.zip`;
if (existsSync(out)) execFileSync("rm", ["-f", out]);

const picked = [];
function walk(dir, prefix = "") {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    if (EXCLUDE_FILES.some((re) => re.test(prefix + name))) continue;
    const full = prefix ? `${prefix}/${name}` : name;
    const st = statSync(`${dir}/${name}`);
    if (st.isDirectory()) walk(`${dir}/${name}`, full);
    else picked.push(full);
  }
}
walk(".");

const manifest = picked.join("\n");
if (process.platform === "win32") {
  execFileSync("tar", ["-a", "-c", "-f", out, "-T", "-"], { input: manifest });
} else {
  execFileSync("zip", ["-q", out, "-@"], { input: manifest });
}
const kb = Math.round(statSync(out).size / 1024);
console.log(`打包完成：${out}（${picked.length} 个文件，${kb} KB）`);
console.log("已排除：" + [...EXCLUDE_DIRS].join(" / ") + " / .env / *.log");
