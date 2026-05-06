export type CompressedImage = {
  dataUrl: string;
  mediaType: "image/jpeg";
  width: number;
  height: number;
  byteEstimate: number;
};

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

export async function compressImage(file: File): Promise<CompressedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-2d-unavailable");
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const byteEstimate = Math.floor(((dataUrl.length - "data:image/jpeg;base64,".length) * 3) / 4);

    return { dataUrl, mediaType: "image/jpeg", width, height, byteEstimate };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-decode-failed"));
    img.src = src;
  });
}
