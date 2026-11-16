import { generateSolidBrandPng } from "@/lib/pwa/pwa-config";

export async function GET() {
  const png = generateSolidBrandPng(512);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
