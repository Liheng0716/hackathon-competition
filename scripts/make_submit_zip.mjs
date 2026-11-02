// scripts/make_submit_zip.mjs —— 生成 AI Works 上传包（纯 Node 实现 ZIP，不依赖 tar/zip 命令）
// 用法：npm run submit  →  jiijian-submit-<日期>.zip
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { deflateRawSync } from "node:zlib";

const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".npm-cache", ".tmp-swc", "__pycache__", "logs", "out", ".claude"]);
const EXCLUDE_FILES = [/^\.env$/, /^\.env\.local$/, /\.log$/, /^jiijian-submit-.*\.zip$/, /^\.tmp-/];

const CRCTABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRCTABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const dosTime = (d) => ({
  time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31),
  date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
});

const date = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const out = `jiijian-submit-${date}.zip`;
if (existsSync(out)) unlinkSync(out);

const files = [];
(function walk(dir, prefix = "") {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (EXCLUDE_FILES.some((re) => re.test(rel))) continue;
    const full = `${dir}/${name}`;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, rel);
    else files.push({ rel, full, st });
  }
})(".");

const chunks = [];
const central = [];
let offset = 0;
for (const { rel, full, st } of files) {
  const name = Buffer.from(rel, "utf8");
  const raw = readFileSync(full);
  const deflated = deflateRawSync(raw, { level: 9 });
  const useDeflate = deflated.length < raw.length;
  const data = useDeflate ? deflated : raw;
  const crc = crc32(raw);
  const { time, date: dosDate } = dosTime(st.mtime);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 名
  local.writeUInt16LE(useDeflate ? 8 : 0, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, name, data);

  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
  cen.writeUInt16LE(time, 12);
  cen.writeUInt16LE(dosDate, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(data.length, 20);
  cen.writeUInt32LE(raw.length, 24);
  cen.writeUInt16LE(name.length, 28);
  cen.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  cen.writeUInt32LE(offset, 42);
  central.push(cen, name);

  offset += local.length + name.length + data.length;
}

const cdBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cdBuf.length, 12);
eocd.writeUInt32LE(offset, 16);

writeFileSync(out, Buffer.concat([...chunks, cdBuf, eocd]));
const kb = Math.round(statSync(out).size / 1024);
console.log(`打包完成：${out}（${files.length} 个文件，${kb} KB）`);
console.log("已排除：" + [...EXCLUDE_DIRS].join(" / ") + " / .env / *.log / 旧 zip");
