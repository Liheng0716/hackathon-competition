// 浏览器端：文件 → 压缩 → dataURL / 裸 base64（够小才发得动 /api/verify）
export function splitDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return { mime: "image/jpeg", base64: dataUrl.replace(/^data:[^,]*,/, "") };
  return { mime: m[1], base64: m[2] };
}

function loadBitmap(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片解码失败，换一张试试"));
    };
    img.src = url;
  });
}

/** 等比缩到最长边 maxEdge，输出 JPEG dataURL；失败则回退原始 dataURL */
export async function compressImage(file: File, maxEdge = 1280, quality = 0.85): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });

  try {
    const bmp = await loadBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return rawDataUrl;
    bmp.draw(ctx, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return rawDataUrl;
  }
}

export function approxKb(base64: string): number {
  return Math.round((base64.length * 3) / 4 / 1024);
}
