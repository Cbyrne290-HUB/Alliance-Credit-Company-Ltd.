const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.7;

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return type === "image/heic" || type === "image/heif" || /\.hei[cf]$/i.test(file.name);
}

/** Canvas can't decode HEIC/HEIF, so those get converted to a browser-native
 * JPEG blob first via heic2any before the resize/compress pass below. */
async function toDecodableBlob(file: File): Promise<Blob> {
  if (!isHeic(file)) return file;

  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(result) ? result[0] : result;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image file."));
    };
    img.src = url;
  });
}

/**
 * Prepares a phone photo for upload: decodes HEIC/HEIF to JPEG if needed,
 * then downscales so the longest edge is at most 1600px and re-encodes as
 * JPEG at ~0.7 quality, turning a multi-MB original into a few hundred KB.
 */
export async function compressImageForUpload(file: File): Promise<Blob> {
  const decodable = await toDecodableBlob(file);
  const img = await loadImage(decodable);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(img.src);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Could not compress image.");

  return blob;
}
