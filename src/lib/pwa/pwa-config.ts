import zlib from "node:zlib";
import type { MetadataRoute } from "next";

export const PWA_MANIFEST: MetadataRoute.Manifest = {
  name: "Ofika Delivery — Livreur",
  short_name: "Ofika Livreur",
  description: "Espace livreur Ofika Delivery : prise en charge et validation des livraisons.",
  start_url: "/livreur",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#FFFFFF",
  theme_color: "#C2410C",
  lang: "fr",
  icons: [
    { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "/icons/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  ],
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc, false);
  return chunk;
}

/**
 * Génère une icône PNG RGBA valide aux couleurs d'Ofika (#111111 + emblème #C2410C/#FFFFFF)
 * sans dépendance image externe. Utilisée pour les icônes 192x192 et 512x512 du manifest PWA.
 */
export function generateSolidBrandPng(size: number): Uint8Array {
  if (!Number.isInteger(size) || size < 16 || size > 1024) {
    throw new RangeError("Taille d'icône PWA invalide.");
  }

  const rowStride = 1 + size * 4;
  const raw = new Uint8Array(rowStride * size);

  const outerPad = Math.floor(size * 0.22);
  const innerPad = Math.floor(size * 0.34);
  const dotSize = Math.floor(size * 0.14);
  const dotStart = size - outerPad - dotSize;

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowStride;
    raw[rowStart] = 0; // filtre PNG 0 (None)
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      let r = 17; // #111111
      let g = 17;
      let b = 17;

      const inOuterBox =
        x >= outerPad && x < size - outerPad && y >= outerPad && y < size - outerPad;
      const inInnerHole =
        x >= innerPad && x < size - innerPad && y >= innerPad && y < size - innerPad;

      if (x >= dotStart && x < size - outerPad && y >= outerPad && y < outerPad + dotSize) {
        r = 194; // #C2410C (orange Ofika)
        g = 65;
        b = 12;
      } else if (inOuterBox && !inInnerHole) {
        r = 255; // #FFFFFF
        g = 255;
        b = 255;
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, size, false);
  ihdrView.setUint32(4, size, false);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = Uint8Array.from(zlib.deflateSync(raw));
  const signature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = pngChunk("IHDR", ihdr);
  const idatChunk = pngChunk("IDAT", compressed);
  const iendChunk = pngChunk("IEND", new Uint8Array(0));

  const out = new Uint8Array(
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length,
  );
  let offset = 0;
  for (const part of [signature, ihdrChunk, idatChunk, iendChunk]) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
