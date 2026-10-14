// Browser-only. Scales a chosen picture to at most `maxSide` pixels on its long side and re-encodes it
// before upload. That keeps it small, and re-drawing it drops the location and camera data a phone
// writes into a photo, so none of that reaches the database. Shared by the Commons picture share and
// the SocketRelay request picture.

export type ScaledPicture = { blob: Blob; width: number; height: number };

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

export async function scalePicture(file: File, maxSide = 1600): Promise<ScaledPicture> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  // A browser that cannot write WebP hands back a PNG instead; a JPEG is much smaller than that.
  const webp = await canvasToBlob(canvas, "image/webp");
  const blob = webp && webp.type === "image/webp" ? webp : await canvasToBlob(canvas, "image/jpeg");
  if (!blob) throw new Error("This browser could not prepare the picture. Try another browser.");
  return { blob, width, height };
}
