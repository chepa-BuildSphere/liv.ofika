import { buildReferenceQrPayload, encodeQrMatrix } from "@/lib/qr/qr-matrix";
import { formatPhone } from "@/lib/validation";
import { deliveryStatusLabel, type DeliveryStatus, type ProofMethod } from "./transitions";

export type DeliveryLabelData = {
  id: string;
  companyName: string;
  reference: string;
  status: DeliveryStatus;
  proofMethod: ProofMethod | null;
  proofMode:
    | "QR"
    | "QR_OTP"
    | "QR_PHOTO"
    | "QR_PHOTO_SIGNATURE"
    | "REVERSE_QR"
    | (string & {});
  recipientName: string;
  recipientPhone: string;
  address: string;
  district: string | null;
  packageDescription: string | null;
  amountToCollect: number | null;
  comment: string | null;
  courierName: string | null;
  createdAt: Date;
};

const WIN_ANSI_EXTRAS: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85, // …
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c, // Œ
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92, // ’
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c, // œ
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function toWinAnsiByte(codePoint: number): number {
  if (codePoint === 0x202f || codePoint === 0x00a0) return 0x20; // espace insécable FR (F CFA / fr-FR)
  if ((codePoint >= 0x20 && codePoint <= 0x7e) || (codePoint >= 0xa0 && codePoint <= 0xff)) {
    return codePoint;
  }
  return WIN_ANSI_EXTRAS[codePoint] ?? 0x3f; // '?'
}

function pdfStringBytes(text: string): number[] {
  const out: number[] = [0x28]; // '('
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0x3f;
    const byte = toWinAnsiByte(code);
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out.push(0x5c, byte); // \(, \), \\
    } else {
      out.push(byte);
    }
  }
  out.push(0x29); // ')'
  return out;
}

class PdfByteBuilder {
  private readonly bytes: number[] = [];

  get length(): number {
    return this.bytes.length;
  }

  pushAscii(str: string) {
    for (let i = 0; i < str.length; i++) {
      this.bytes.push(str.charCodeAt(i) & 0x7f);
    }
  }

  pushBytes(chunk: number[]) {
    for (let i = 0; i < chunk.length; i++) {
      this.bytes.push(chunk[i] & 0xff);
    }
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return ["—"];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word.slice(0, maxChars);
      if (word.length > maxChars) {
        lines.push(current);
        current = word.slice(maxChars);
      }
      continue;
    }
    if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Génère un document PDF 1.4 A4 autonome (zéro dépendance externe) contenant
 * les informations de la course et le QR de référence vectoriel.
 */
export function renderDeliveryLabelPdf(data: DeliveryLabelData): Uint8Array {
  const qrPayload = buildReferenceQrPayload({ id: data.id, reference: data.reference });
  const qrMatrix = encodeQrMatrix(qrPayload);

  const statusText = deliveryStatusLabel(data.status, data.proofMethod);
  const createdText = data.createdAt.toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "short",
    timeStyle: "short",
  });
  const amountText =
    data.amountToCollect !== null
      ? `${data.amountToCollect.toLocaleString("fr-FR")} F CFA`
      : "Aucun encaissement";
  const proofModeText = data.proofMode === "QR_OTP" ? "QR code + OTP" : "QR code";

  // Flux de contenu PDF (A4 = 595.28 x 841.89 pt, origine en bas à gauche)
  const content = new PdfByteBuilder();

  const drawText = (font: "F1" | "F2" | "F3", size: number, x: number, y: number, text: string) => {
    content.pushAscii(`BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm `);
    content.pushBytes(pdfStringBytes(text));
    content.pushAscii(" Tj ET\n");
  };

  // Cadre extérieur & en-tête
  content.pushAscii("0.07 0.07 0.07 RG 1 w 36 42 523.28 763.89 re S\n");
  content.pushAscii("0.98 0.98 0.98 rg 36 742 523.28 63.89 re f\n");
  content.pushAscii("0.85 0.85 0.85 RG 0.8 w 36 742 m 559.28 742 l S\n");

  content.pushAscii("0.07 0.07 0.07 rg\n");
  drawText("F2", 14, 52, 779, "OFIKA DELIVERY - BORDEREAU DE LIVRAISON");
  drawText("F1", 10, 52, 758, `${data.companyName}  |  Créé le ${createdText} (Abidjan)`);

  // Bloc Référence + Statut
  content.pushAscii("0.85 0.85 0.85 RG 0.8 w 36 672 m 559.28 672 l S\n");
  content.pushAscii("0.45 0.45 0.45 rg\n");
  drawText("F2", 8, 52, 718, "RÉFÉRENCE COMMANDE");
  drawText("F2", 8, 360, 718, "STATUT ACTUEL");

  content.pushAscii("0.07 0.07 0.07 rg\n");
  drawText("F3", 18, 52, 692, data.reference);
  drawText("F2", 13, 360, 694, statusText);

  // Bloc Destinataire (colonne gauche) + QR de référence (colonne droite)
  content.pushAscii("0.45 0.45 0.45 rg\n");
  drawText("F2", 8, 52, 646, "DESTINATAIRE");
  content.pushAscii("0.07 0.07 0.07 rg\n");
  drawText("F2", 13, 52, 626, data.recipientName);
  drawText("F1", 11, 52, 608, `Tél : ${formatPhone(data.recipientPhone)}`);

  let yCursor = 584;
  content.pushAscii("0.45 0.45 0.45 rg\n");
  drawText("F2", 8, 52, yCursor, "ADRESSE DE LIVRAISON");
  yCursor -= 18;
  content.pushAscii("0.07 0.07 0.07 rg\n");
  for (const line of wrapText(data.address, 42).slice(0, 3)) {
    drawText("F1", 11, 52, yCursor, line);
    yCursor -= 16;
  }
  if (data.district) {
    drawText("F1", 10, 52, yCursor, `Quartier : ${data.district}`);
    yCursor -= 18;
  }

  // QR de référence vectoriel à droite
  const qrSizePt = 136;
  const qrX = 398;
  const qrY = 516;
  const modulePt = qrSizePt / qrMatrix.length;
  content.pushAscii("0.90 0.90 0.90 RG 0.8 w ");
  content.pushAscii(`${(qrX - 10).toFixed(2)} ${(qrY - 36).toFixed(2)} ${(qrSizePt + 20).toFixed(2)} ${(qrSizePt + 46).toFixed(2)} re S\n`);
  content.pushAscii("0.07 0.07 0.07 rg\n");
  for (let r = 0; r < qrMatrix.length; r++) {
    for (let c = 0; c < qrMatrix[r].length; c++) {
      if (!qrMatrix[r][c]) continue;
      const rx = qrX + c * modulePt;
      const ry = qrY + qrSizePt - (r + 1) * modulePt;
      content.pushAscii(
        `${rx.toFixed(2)} ${ry.toFixed(2)} ${modulePt.toFixed(2)} ${modulePt.toFixed(2)} re f\n`,
      );
    }
  }
  drawText("F2", 7.5, qrX - 2, qrY - 14, "QR DE RÉFÉRENCE (TRI / RETOUR)");
  content.pushAscii("0.45 0.45 0.45 rg\n");
  drawText("F1", 7, qrX - 2, qrY - 26, "Ne valide pas la remise client");

  // Séparateur milieu de fiche
  content.pushAscii("0.85 0.85 0.85 RG 0.8 w 36 456 m 559.28 456 l S\n");

  // Bloc Colis & Livreur
  content.pushAscii("0.45 0.45 0.45 rg\n");
  drawText("F2", 8, 52, 434, "LIVREUR AFFECTÉ");
  drawText("F2", 8, 280, 434, "MONTANT À ENCAISSER");
  drawText("F2", 8, 435, 434, "PREUVE DEMANDÉE");

  content.pushAscii("0.07 0.07 0.07 rg\n");
  drawText("F2", 12, 52, 414, data.courierName ?? "Non affectée");
  drawText("F2", 12, 280, 414, amountText);
  drawText("F1", 11, 435, 414, proofModeText);

  let detailY = 380;
  content.pushAscii("0.45 0.45 0.45 rg\n");
  drawText("F2", 8, 52, detailY, "CONTENU DU COLIS");
  detailY -= 16;
  content.pushAscii("0.07 0.07 0.07 rg\n");
  for (const line of wrapText(data.packageDescription ?? "Non précisé", 76).slice(0, 3)) {
    drawText("F1", 10.5, 52, detailY, line);
    detailY -= 15;
  }

  detailY -= 12;
  content.pushAscii("0.45 0.45 0.45 rg\n");
  drawText("F2", 8, 52, detailY, "COMMENTAIRE");
  detailY -= 16;
  content.pushAscii("0.07 0.07 0.07 rg\n");
  for (const line of wrapText(data.comment ?? "—", 76).slice(0, 3)) {
    drawText("F1", 10.5, 52, detailY, line);
    detailY -= 15;
  }

  // Pied de page
  content.pushAscii("0.85 0.85 0.85 RG 0.8 w 36 86 m 559.28 86 l S\n");
  content.pushAscii("0.45 0.45 0.45 rg\n");
  drawText("F3", 8.5, 52, 66, `Payload QR : ${qrPayload}`);
  drawText("F1", 8.5, 52, 52, `Identifiant course : ${data.id}  |  Ofika Delivery`);

  const contentBytes = content.toUint8Array();

  // Assemblage du fichier PDF 1.4 avec table xref exacte
  const pdf = new PdfByteBuilder();
  pdf.pushAscii("%PDF-1.4\n%");
  pdf.pushBytes([0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
  const offsets: number[] = [0];

  const writeObj = (id: number, bodyFn: () => void) => {
    offsets[id] = pdf.length;
    pdf.pushAscii(`${id} 0 obj\n`);
    bodyFn();
    pdf.pushAscii("\nendobj\n");
  };

  writeObj(1, () => {
    pdf.pushAscii("<< /Type /Catalog /Pages 2 0 R >>");
  });

  writeObj(2, () => {
    pdf.pushAscii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  });

  writeObj(3, () => {
    pdf.pushAscii(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>",
    );
  });

  writeObj(4, () => {
    pdf.pushAscii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  });

  writeObj(5, () => {
    pdf.pushAscii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  });

  writeObj(6, () => {
    pdf.pushAscii("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  });

  writeObj(7, () => {
    pdf.pushAscii(`<< /Length ${contentBytes.length} >>\nstream\n`);
    for (let i = 0; i < contentBytes.length; i++) {
      pdf.pushBytes([contentBytes[i]]);
    }
    pdf.pushAscii("\nendstream");
  });

  writeObj(8, () => {
    pdf.pushAscii("<< /Title ");
    pdf.pushBytes(pdfStringBytes(`Bordereau ${data.reference}`));
    pdf.pushAscii(" /Subject ");
    pdf.pushBytes(pdfStringBytes(`Ofika Delivery - ${statusText}`));
    pdf.pushAscii(" /Keywords ");
    pdf.pushBytes(pdfStringBytes(qrPayload));
    pdf.pushAscii(" >>");
  });

  const xrefOffset = pdf.length;
  pdf.pushAscii(`xref\n0 ${offsets.length}\n`);
  pdf.pushAscii("0000000000 65535 f \n");
  for (let id = 1; id < offsets.length; id++) {
    const padded = String(offsets[id]).padStart(10, "0");
    pdf.pushAscii(`${padded} 00000 n \n`);
  }
  pdf.pushAscii(`trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 8 0 R >>\n`);
  pdf.pushAscii(`startxref\n${xrefOffset}\n%%EOF\n`);

  return pdf.toUint8Array();
}
