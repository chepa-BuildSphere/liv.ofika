// Encodeur QR ISO/IEC 18004 (versions 1 à 6, niveau de correction L, mode Byte UTF-8).
// Sans dépendance externe : génère une matrice booléenne (true = module noir) et un SVG.

const VERSION_SPEC = [
  // [version, totalCodewords, ecPerBlock, numBlocks, alignCoords]
  { version: 1, totalCodewords: 26, ecPerBlock: 7, numBlocks: 1, align: [] as readonly number[] },
  { version: 2, totalCodewords: 44, ecPerBlock: 10, numBlocks: 1, align: [6, 18] as readonly number[] },
  { version: 3, totalCodewords: 70, ecPerBlock: 15, numBlocks: 1, align: [6, 22] as readonly number[] },
  { version: 4, totalCodewords: 100, ecPerBlock: 20, numBlocks: 1, align: [6, 26] as readonly number[] },
  { version: 5, totalCodewords: 134, ecPerBlock: 26, numBlocks: 1, align: [6, 30] as readonly number[] },
  { version: 6, totalCodewords: 172, ecPerBlock: 18, numBlocks: 2, align: [6, 34] as readonly number[] },
] as const;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly: number[] = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return Uint8Array.from(poly);
}

function rsRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const rem = new Uint8Array(data.length + ecCount);
  rem.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = rem[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      rem[i + j] ^= gfMul(gen[j], factor);
    }
  }
  return rem.slice(data.length);
}

function pushBits(bits: number[], val: number, len: number) {
  for (let i = len - 1; i >= 0; i--) {
    bits.push((val >>> i) & 1);
  }
}

function formatInfoBits(ecLevelBits: number, mask: number): number {
  const data = ((ecLevelBits & 0b11) << 3) | (mask & 0b111);
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}

export function buildReferenceQrPayload(delivery: { id: string; reference: string }): string {
  return `OFIKA-REF:${delivery.reference}:${delivery.id}`;
}

const UUID_SUFFIX_RE =
  /^OFIKA-REF:(.+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function parseReferenceQrPayload(
  raw: string,
): { reference: string; deliveryId: string | null } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = UUID_SUFFIX_RE.exec(trimmed);
  if (match) {
    return { reference: match[1], deliveryId: match[2].toLowerCase() };
  }
  return { reference: trimmed, deliveryId: null };
}

/**
 * Encode une chaîne UTF-8 en matrice carrée QR (version 1 à 6, correction L, masque 0).
 * Chaque case vaut `true` pour un module sombre, `false` pour un module clair.
 */
export function encodeQrMatrix(text: string): boolean[][] {
  const payload = new TextEncoder().encode(text);
  const spec = VERSION_SPEC.find((v) => {
    const dataCodewords = v.totalCodewords - v.ecPerBlock * v.numBlocks;
    const capacityBytes = Math.floor((dataCodewords * 8 - 12) / 8);
    return payload.length <= capacityBytes;
  });

  if (!spec) {
    throw new RangeError(`Contenu QR trop long (${payload.length} octets, maximum 134).`);
  }

  const totalDataCodewords = spec.totalCodewords - spec.ecPerBlock * spec.numBlocks;
  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // Mode Byte
  pushBits(bits, payload.length, 8);
  for (const byte of payload) {
    pushBits(bits, byte, 8);
  }

  const dataBitLimit = totalDataCodewords * 8;
  const terminatorLen = Math.min(4, dataBitLimit - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < dataBitLimit) {
    pushBits(bits, padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const dataBytes = new Uint8Array(totalDataCodewords);
  for (let i = 0; i < totalDataCodewords; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) {
      b = (b << 1) | bits[i * 8 + k];
    }
    dataBytes[i] = b;
  }

  // Découpe en blocs + ECC Reed-Solomon + entrelacement
  const blockDataLen = Math.floor(totalDataCodewords / spec.numBlocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.numBlocks; b++) {
    const slice = dataBytes.slice(b * blockDataLen, (b + 1) * blockDataLen);
    dataBlocks.push(slice);
    ecBlocks.push(rsRemainder(slice, spec.ecPerBlock));
  }

  const allCodewords: number[] = [];
  for (let i = 0; i < blockDataLen; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      allCodewords.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      allCodewords.push(ecBlocks[b][i]);
    }
  }

  const size = 17 + 4 * spec.version;
  const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setFn = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    isFunction[r][c] = true;
  };

  // Motifs de détection 7x7 + séparateur 1 module
  const drawFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        const dark = dist !== 2 && dist !== 4;
        setFn(top + dr, left + dc, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Motifs d'alignement (versions >= 2)
  for (const ar of spec.align) {
    for (const ac of spec.align) {
      let overlaps = false;
      for (let dr = -2; dr <= 2 && !overlaps; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (isFunction[ar + dr][ac + dc]) {
            overlaps = true;
            break;
          }
        }
      }
      if (overlaps) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFn(ar + dr, ac + dc, dist !== 1);
        }
      }
    }
  }

  // Motifs de synchronisation (ligne 6 / colonne 6)
  for (let i = 8; i <= size - 9; i++) {
    const dark = i % 2 === 0;
    if (!isFunction[6][i]) setFn(6, i, dark);
    if (!isFunction[i][6]) setFn(i, 6, dark);
  }

  // Informations de format (niveau L = 01, masque 0 = 000)
  const formatBits = formatInfoBits(0b01, 0);
  for (let i = 0; i <= 5; i++) setFn(8, i, ((formatBits >>> i) & 1) === 1);
  setFn(8, 7, ((formatBits >>> 6) & 1) === 1);
  setFn(8, 8, ((formatBits >>> 7) & 1) === 1);
  setFn(7, 8, ((formatBits >>> 8) & 1) === 1);
  for (let i = 9; i < 15; i++) setFn(14 - i, 8, ((formatBits >>> i) & 1) === 1);

  for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, ((formatBits >>> i) & 1) === 1);
  for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, ((formatBits >>> i) & 1) === 1);

  // Module sombre fixe
  setFn(size - 8, 8, true);

  // Placement des bits de données en zigzag + masque 0 ((r + c) % 2 === 0)
  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (isFunction[row][col]) continue;
        let bit = 0;
        if (bitIdx < totalBits) {
          const byte = allCodewords[bitIdx >>> 3];
          bit = (byte >>> (7 - (bitIdx & 7))) & 1;
          bitIdx++;
        }
        if ((row + col) % 2 === 0) bit ^= 1;
        modules[row][col] = bit === 1;
      }
    }
  }

  return modules;
}

/** Génère un SVG autonome pour afficher le QR code côté interface. */
export function renderQrSvg(
  text: string,
  options: { moduleSize?: number; margin?: number } = {},
): string {
  const matrix = encodeQrMatrix(text);
  const scale = options.moduleSize ?? 4;
  const margin = options.margin ?? 4;
  const dim = (matrix.length + margin * 2) * scale;
  const rects: string[] = [];

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        rects.push(`M${(c + margin) * scale},${(r + margin) * scale}h${scale}v${scale}h-${scale}z`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#ffffff"/><path d="${rects.join("")}" fill="#111111"/></svg>`;
}
