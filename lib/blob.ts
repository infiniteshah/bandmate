import { put } from "@vercel/blob";

export async function uploadImageFromUrl(
  url: string,
  pathname: string,
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image from generator: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "image/png";
  const blob = await res.blob();
  const uploaded = await put(pathname, blob, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return uploaded.url;
}

export async function uploadBytes(
  bytes: ArrayBuffer | Buffer | Uint8Array,
  pathname: string,
  contentType: string,
): Promise<string> {
  const uploaded = await put(pathname, bytes as Buffer, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return uploaded.url;
}
