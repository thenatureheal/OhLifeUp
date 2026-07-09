/**
 * Read an image File, downscale it so the longest side ≤ maxDim, and return a
 * compressed JPEG data URL.
 *
 * Product images are stored INLINE in the product's Firestore document (no
 * Firebase Storage setup required), so the result must stay comfortably under
 * the 1 MB document limit. We step the JPEG quality down until the encoded size
 * is under `targetBytes`.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxDim = 800,
  targetBytes = 400_000
): Promise<string> {
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    el.src = sourceUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서는 이미지 처리를 지원하지 않습니다.");

  // White backdrop so transparent PNGs don't render as black under JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // base64 payload ≈ 4/3 of the raw byte size — compare against that.
  let quality = 0.85;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length * 0.75 > targetBytes && quality > 0.4) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}
