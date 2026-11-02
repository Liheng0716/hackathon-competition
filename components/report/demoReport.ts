// data/reports/ 还没产出时的内联演示报告（结构严格按报告契约）
import type { Report } from "./types";

export const DEMO_REPORT: Report = {
  model_id: "iphone-13-128g",
  generated_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  verdict: "buy",
  verdict_reason: "二手价已跌到近 30 天低位，A15 性能仍够用，唯一硬伤是电池健康度普遍在 85% 左右。",
  price_position: "历史低位 · 12% 百分位（近 30 天 3280-3600 元区间）",
  pros: [
    "A15 芯片日常与游戏都够用，系统更新还能撑 2-3 年",
    "6.1 寸机身轻，单手友好，二手流通量大好出手",
    "屏幕素质在同价位二手里有优势，原彩正常",
  ],
  cons: [
    "电池健康度普遍 85% 上下，重度使用一天两充",
    "128G 版本装完系统和常用 App 剩余空间偏紧",
    "刘海屏 + 60Hz，用过高刷会不适应",
  ],
  pitfalls: [
    "换屏机常见：核对「原彩显示」是否还在，缺了基本是后换屏",
    "翻新外壳机：边框倒角处漆面不均、卡托缝隙大要警惕",
    "有锁机冒充国行：当面查设置-通用-关于本机的型号号码是否为 CH/A",
  ],
  sources: [
    { title: "中关村在线 · iPhone 13 参数与报价", url: "https://detail.zol.com.cn/cell_phone/index1372800.shtml" },
    { title: "京东 · iPhone 13 128G 商品页", url: "https://search.jd.com/Search?keyword=iPhone%2013%20128G&enc=utf-8" },
    { title: "闲鱼 · iPhone 13 128G 在售行情", url: "https://www.goofish.com/search?q=iPhone%2013%20128G" },
  ],
};
