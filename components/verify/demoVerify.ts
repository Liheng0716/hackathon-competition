// API 未就绪时的内联兜底样例（结构严格按识机 JSON 契约）
import type { VerifyResult } from "./types";

export const DEMO_VERIFY: VerifyResult = {
  category: "手机",
  model_guess: "iPhone 13",
  confidence: 86,
  visible_defects: [
    { area: "屏幕", type: "划痕", severity: "轻微", detail: "右下角细划，强光下可见" },
    { area: "上左", type: "磕碰", severity: "中等", detail: "左上角边框一处小磕碰" },
    { area: "正中", type: "屏幕细划", severity: "轻微", detail: "屏幕中心轻微发丝划痕" },
    { area: "背面", type: "油污", severity: "轻微", detail: "玻璃背板指纹油污，可擦除" },
  ],
  condition_score: 78,
  notes: "整体良好，无拆修痕迹，屏幕无进水印记，边框有轻微磕碰，属正常二手成色。",
};

export const DEMO_VERIFY_RISKY: VerifyResult = {
  category: "手机",
  model_guess: "iPhone 13",
  confidence: 72,
  visible_defects: [
    { area: "屏幕", type: "换屏痕迹", severity: "严重", detail: "屏幕四周胶线不均，疑似后换屏" },
    { area: "接口", type: "氧化", severity: "中等", detail: "充电口内部有轻微氧化" },
    { area: "下右", type: "掉漆", severity: "中等", detail: "右下边框掉漆" },
  ],
  condition_score: 58,
  notes: "屏幕疑似维修更换，接口有轻微进水氧化痕迹，议价前建议当面拆检。",
};
