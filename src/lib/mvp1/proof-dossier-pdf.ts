import { formatPhone } from "@/lib/validation";
import { deliveryStatusLabel, type DeliveryStatus, type ProofMethod } from "@/lib/deliveries/transitions";

export type ProofDossierEvent = {
  id: number;
  eventType: string;
  actorType: string;
  actorId: string | null;
  serverTime: Date;
  hash: string;
  prevHash: string | null;
  lat: number | null;
  lng: number | null;
  ip: string | null;
};

export type ProofDossierData = {
  id: string;
  companyName: string;
  reference: string;
  status: DeliveryStatus;
  proofMethod: ProofMethod | null;
  proofMode: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  district: string | null;
  packageDescription: string | null;
  amountToCollect: number | null;
  amountCollected: number | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  deliveredAt: Date | null;
  courierName: string | null;
  courierPhone: string | null;
  clientLat: number | null;
  clientLng: number | null;
  clientAccuracy: number | null;
  clientIp: string | null;
  events: ProofDossierEvent[];
};

const WIN_ANSI_EXTRAS: Record<number, number> = {
  0x20ac: 0x80, // €
  0x2026: 0x85, // …
  0x0152: 0x8c, // Œ
  0x2018: 0x91,
  0x2019: 0x92, // ’
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x0153: 0x9c, // œ
};

function toWinAnsiByte(codePoint: number): number {
  if (codePoint === 0x202f || codePoint === 0x00a0) return 0x20;
  if ((codePoint >= 0x20 && codePoint <= 0x7e) || (codePoint >= 0xa0 && codePoint <= 0xff)) {
    return codePoint;
  }
  return WIN_ANSI_EXTRAS[codePoint] ?? 0x3f;
}

function pdfStringBytes(text: string): number[] {
  const out: number[] = [0x28];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0x3f;
    const byte = toWinAnsiByte(code);
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out.push(0x5c, byte);
    } else {
      out.push(byte);
    }
  }
  out.push(0x29);
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

/**
 * Rendu haute-fidélité autonome du Dossier de Preuve de Livraison (PDF 1.4).
 */
export function renderProofDossierPdf(data: ProofDossierData): Uint8Array {
  const builder = new PdfByteBuilder();
  builder.pushAscii("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");

  const pageW = 595.28; // A4 portrait
  const pageH = 841.89;
  const marginX = 40;

  const contentStream = new PdfByteBuilder();

  // En-tête officiel orange
  contentStream.pushAscii("q\n");
  contentStream.pushAscii("0.76 0.25 0.05 rg\n"); // #C2410C
  contentStream.pushAscii(`0 ${pageH - 65} ${pageW} 65 re f\n`);
  contentStream.pushAscii("Q\n");

  // Titre blanc dans l'en-tête
  contentStream.pushAscii("BT\n");
  contentStream.pushAscii("/F2 18 Tf\n");
  contentStream.pushAscii("1 1 1 rg\n");
  contentStream.pushAscii(`1 0 0 1 ${marginX} ${pageH - 40} Tm\n`);
  contentStream.pushBytes(pdfStringBytes("OFIKA DELIVERY — DOSSIER DE PREUVE"));
  contentStream.pushAscii("ET\n");

  contentStream.pushAscii("BT\n");
  contentStream.pushAscii("/F1 10 Tf\n");
  contentStream.pushAscii("1 1 1 rg\n");
  contentStream.pushAscii(`1 0 0 1 ${marginX} ${pageH - 55} Tm\n`);
  contentStream.pushBytes(pdfStringBytes("CERTIFICAT DE NON-REPUDIATION ET JOURNAL DE TRAÇABILITE"));
  contentStream.pushAscii("ET\n");

  let y = pageH - 95;

  // Ligne de métadonnées principales
  function drawField(label: string, value: string, x: number, currY: number, size = 10, isBold = false) {
    contentStream.pushAscii("BT\n");
    contentStream.pushAscii(`/F${isBold ? "2" : "1"} ${size} Tf\n`);
    contentStream.pushAscii("0.2 0.2 0.2 rg\n");
    contentStream.pushAscii(`1 0 0 1 ${x} ${currY} Tm\n`);
    contentStream.pushBytes(pdfStringBytes(`${label}: `));
    contentStream.pushAscii("0 0 0 rg\n");
    contentStream.pushBytes(pdfStringBytes(value));
    contentStream.pushAscii("ET\n");
  }

  function drawSectionTitle(title: string, currY: number) {
    contentStream.pushAscii("q\n");
    contentStream.pushAscii("0.95 0.95 0.95 rg\n");
    contentStream.pushAscii(`${marginX} ${currY - 5} ${pageW - 2 * marginX} 20 re f\n`);
    contentStream.pushAscii("0.76 0.25 0.05 rg\n");
    contentStream.pushAscii(`${marginX} ${currY - 5} 3 20 re f\n`);
    contentStream.pushAscii("Q\n");

    contentStream.pushAscii("BT\n");
    contentStream.pushAscii("/F2 11 Tf\n");
    contentStream.pushAscii("0.1 0.1 0.1 rg\n");
    contentStream.pushAscii(`1 0 0 1 ${marginX + 10} ${currY} Tm\n`);
    contentStream.pushBytes(pdfStringBytes(title));
    contentStream.pushAscii("ET\n");
  }

  // Section 1 : Information Colis & Expéditeur
  drawSectionTitle("1. IDENTIFICATION DU COLIS & ENTREPRISE", y);
  y -= 25;
  drawField("Entreprise cliente", data.companyName, marginX, y, 10, true);
  drawField("Reference commande", data.reference, marginX + 260, y, 10, true);
  y -= 16;
  drawField("Destinataire", data.recipientName, marginX, y);
  drawField("Contact", formatPhone(data.recipientPhone), marginX + 260, y);
  y -= 16;
  drawField("Adresse de livraison", `${data.address}${data.district ? " (" + data.district + ")" : ""}`, marginX, y);
  y -= 16;
  drawField("Statut livraison", deliveryStatusLabel(data.status), marginX, y, 10, true);
  drawField("Methode de preuve", data.proofMethod ?? "En attente", marginX + 260, y, 10, true);

  y -= 30;

  // Section 2 : Preuves matérielles et géolocalisation
  drawSectionTitle("2. PREUVES DE REMISE & GEOLOCALISATION CERTIFIEE", y);
  y -= 25;
  drawField(
    "Date et heure de livraison",
    data.deliveredAt ? data.deliveredAt.toISOString() : "Non livree",
    marginX,
    y,
  );
  drawField("Livreur affecte", data.courierName ? `${data.courierName} (${formatPhone(data.courierPhone ?? "")})` : "Non affecte", marginX + 260, y);
  y -= 16;
  drawField(
    "Coordonnees GPS (Client)",
    data.clientLat != null && data.clientLng != null
      ? `${data.clientLat.toFixed(5)}, ${data.clientLng.toFixed(5)} (precision: ${data.clientAccuracy ?? "?"}m)`
      : "Non capturees ou GPS manquant",
    marginX,
    y,
  );
  drawField("Adresse IP client", data.clientIp ?? "Non renseignee", marginX + 260, y);

  y -= 30;

  // Section 3 : Encaissements
  drawSectionTitle("3. GESTION DES ENCAISSEMENTS (PAIEMENT A LA LIVRAISON)", y);
  y -= 25;
  drawField("Montant prevu", data.amountToCollect != null ? `${data.amountToCollect} F CFA` : "0 F CFA", marginX, y);
  drawField(
    "Montant encaisse",
    data.amountCollected != null ? `${data.amountCollected} F CFA` : "0 F CFA",
    marginX + 260,
    y,
    10,
    true,
  );
  y -= 16;
  drawField("Mode de paiement", data.paymentMethod ?? "Aucun", marginX, y);
  drawField("Reference transaction", data.paymentReference ?? "Aucune", marginX + 260, y);

  y -= 30;

  // Section 4 : Chaîne d'Audit Immuable (Journal SHA-256)
  drawSectionTitle("4. JOURNAL D'AUDIT CERTIFIE (CHAINE DE HASH SHA-256)", y);
  y -= 20;

  contentStream.pushAscii("BT\n");
  contentStream.pushAscii("/F2 8 Tf\n");
  contentStream.pushAscii("0.3 0.3 0.3 rg\n");
  contentStream.pushAscii(`1 0 0 1 ${marginX} ${y} Tm\n`);
  contentStream.pushBytes(pdfStringBytes("EVENEMENT                     DATE/HEURE UTC             ACTEUR          EMPREINTE HASH (SHA-256)"));
  contentStream.pushAscii("ET\n");

  y -= 12;
  const recentEvents = data.events.slice(-8); // les 8 plus récents
  for (const ev of recentEvents) {
    contentStream.pushAscii("BT\n");
    contentStream.pushAscii("/F1 7 Tf\n");
    contentStream.pushAscii("0.1 0.1 0.1 rg\n");
    contentStream.pushAscii(`1 0 0 1 ${marginX} ${y} Tm\n`);

    const evType = (ev.eventType + "                         ").slice(0, 26);
    const dateStr = (ev.serverTime.toISOString() + "      ").slice(0, 25);
    const actor = (ev.actorType + "       ").slice(0, 14);
    const hashShort = ev.hash.slice(0, 32) + "...";
    contentStream.pushBytes(pdfStringBytes(`${evType}${dateStr}${actor}${hashShort}`));
    contentStream.pushAscii("ET\n");
    y -= 12;
  }

  // Pied de page légal
  contentStream.pushAscii("q\n");
  contentStream.pushAscii("0.8 0.8 0.8 rg\n");
  contentStream.pushAscii(`${marginX} 45 ${pageW - 2 * marginX} 0.5 re f\n`);
  contentStream.pushAscii("Q\n");

  contentStream.pushAscii("BT\n");
  contentStream.pushAscii("/F1 7 Tf\n");
  contentStream.pushAscii("0.4 0.4 0.4 rg\n");
  contentStream.pushAscii(`1 0 0 1 ${marginX} 32 Tm\n`);
  contentStream.pushBytes(
    pdfStringBytes(
      "Document genere automatiquement par la plateforme Ofika Delivery. Fait foi de preuve technique au sens de la loi n° 2013-450.",
    ),
  );
  contentStream.pushAscii("ET\n");

  contentStream.pushAscii("BT\n");
  contentStream.pushAscii("/F2 7 Tf\n");
  contentStream.pushAscii("0.76 0.25 0.05 rg\n");
  contentStream.pushAscii(`1 0 0 1 ${marginX} 20 Tm\n`);
  contentStream.pushBytes(
    pdfStringBytes(`Identifiant preuve unique : ${data.id} — Securise par Lakebase Postgres & SHA-256`),
  );
  contentStream.pushAscii("ET\n");

  const streamBytes = contentStream.toUint8Array();

  // Structure des objets PDF
  const offsets: number[] = [];
  function recordObject(id: number) {
    offsets[id] = builder.length;
    builder.pushAscii(`${id} 0 obj\n`);
  }

  // 1: Catalog
  recordObject(1);
  builder.pushAscii("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2: Pages
  recordObject(2);
  builder.pushAscii(`<< /Type /Pages /Kids [ 3 0 R ] /Count 1 >>\nendobj\n`);

  // 3: Page
  recordObject(3);
  builder.pushAscii(
    `<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${pageW} ${pageH} ] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`,
  );

  // 4: Contents
  recordObject(4);
  builder.pushAscii(`<< /Length ${streamBytes.length} >>\nstream\n`);
  builder.pushBytes(Array.from(streamBytes));
  builder.pushAscii("\nendstream\nendobj\n");

  // 5: Font F1 (Helvetica WinAnsi)
  recordObject(5);
  builder.pushAscii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");

  // 6: Font F2 (Helvetica-Bold WinAnsi)
  recordObject(6);
  builder.pushAscii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");

  // Xref
  const xrefOffset = builder.length;
  builder.pushAscii("xref\n");
  builder.pushAscii(`0 7\n`);
  builder.pushAscii("0000000000 65535 f \n");
  for (let i = 1; i <= 6; i++) {
    const off = String(offsets[i]).padStart(10, "0");
    builder.pushAscii(`${off} 00000 n \n`);
  }

  builder.pushAscii("trailer\n");
  builder.pushAscii("<< /Size 7 /Root 1 0 R >>\n");
  builder.pushAscii("startxref\n");
  builder.pushAscii(`${xrefOffset}\n`);
  builder.pushAscii("%%EOF\n");

  return builder.toUint8Array();
}

export function generateProofDossierPdf(data: ProofDossierData): Buffer {
  return Buffer.from(renderProofDossierPdf(data));
}
