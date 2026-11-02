// GET /api/models?tier=1&brand=Apple —— 机型目录过滤（泳道2）
import type { Model } from "@/lib/data";
import { readModels } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * 过滤参数：
 *   tier=1 | tier=1,2     精确档位（可逗号多档）
 *   brand=Apple           品牌，大小写不敏感，支持包含匹配（"app" 也能命中 Apple）
 *   q=小米                在 name/variant/keywords_xianyu 里模糊搜
 * 不传参数返回全部 20 款。响应体是数组本身。
 */
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  let list: Model[] = readModels();

  const tierRaw = searchParams.get("tier");
  if (tierRaw) {
    const tiers = tierRaw
      .split(",")
      .map((t) => Number(t.trim()))
      .filter((n) => Number.isFinite(n));
    if (tiers.length) list = list.filter((m) => tiers.includes(Number(m.tier)));
  }

  const brand = (searchParams.get("brand") || "").trim().toLowerCase();
  if (brand) {
    list = list.filter((m) => {
      const b = String(m.brand || "").toLowerCase();
      return b === brand || b.includes(brand);
    });
  }

  const q = (searchParams.get("q") || "").trim().toLowerCase();
  if (q) {
    list = list.filter((m) =>
      [m.name, m.variant, m.keywords_xianyu, m.brand]
        .map((x) => String(x || "").toLowerCase())
        .some((x) => x.includes(q))
    );
  }

  return json(list);
}
