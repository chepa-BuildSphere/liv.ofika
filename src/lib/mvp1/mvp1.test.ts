import { describe, expect, it } from "vitest";
import {
  getProofModeRequirements,
  validateProofRequirements,
} from "./proof-levels";
import {
  buildReverseQrPayload,
  parseReverseQrPayload,
} from "./reverse-qr";
import { sanitizeText } from "./comments-disputes";
import { generateProofDossierPdf } from "./proof-dossier-pdf";

describe("MVP 1 - Niveaux de Preuve Configurables", () => {
  it("retourne les exigences correctes pour chaque mode de preuve", () => {
    const qrReq = getProofModeRequirements("QR");
    expect(qrReq.requiresOtp).toBe(false);
    expect(qrReq.requiresPhoto).toBe(false);
    expect(qrReq.requiresSignature).toBe(false);
    expect(qrReq.isReverseQr).toBe(false);

    const otpReq = getProofModeRequirements("QR_OTP");
    expect(otpReq.requiresOtp).toBe(true);
    expect(otpReq.requiresPhoto).toBe(false);

    const photoReq = getProofModeRequirements("QR_PHOTO");
    expect(photoReq.requiresPhoto).toBe(true);
    expect(photoReq.requiresSignature).toBe(false);

    const sigReq = getProofModeRequirements("QR_PHOTO_SIGNATURE");
    expect(sigReq.requiresPhoto).toBe(true);
    expect(sigReq.requiresSignature).toBe(true);

    const revReq = getProofModeRequirements("REVERSE_QR");
    expect(revReq.isReverseQr).toBe(true);
  });

  it("valide la présence de la photo pour QR_PHOTO", () => {
    const withoutPhoto = validateProofRequirements("QR_PHOTO", {});
    expect(withoutPhoto.valid).toBe(false);
    expect(withoutPhoto.error).toMatch(/photo/i);

    const withPhoto = validateProofRequirements("QR_PHOTO", {
      photoUrl: "data:image/jpeg;base64,123",
    });
    expect(withPhoto.valid).toBe(true);
  });

  it("valide la présence de la signature pour QR_PHOTO_SIGNATURE", () => {
    const onlyPhoto = validateProofRequirements("QR_PHOTO_SIGNATURE", {
      photoUrl: "data:image/jpeg;base64,123",
    });
    expect(onlyPhoto.valid).toBe(false);
    expect(onlyPhoto.error).toMatch(/signature/i);

    const complete = validateProofRequirements("QR_PHOTO_SIGNATURE", {
      photoUrl: "data:image/jpeg;base64,123",
      signatureUrl: "data:image/png;base64,abc",
    });
    expect(complete.valid).toBe(true);
  });
});

describe("MVP 1 - QR Inversé (Reverse QR)", () => {
  const reference = "OFIKA-TEST-001";
  const token = "a8f3b29c94e015d8f6";

  it("construit et parse avec succès une charge utile de QR inversé valide", () => {
    const payload = buildReverseQrPayload(reference, token);
    expect(payload.startsWith("OFIKA-REV:")).toBe(true);

    const parsed = parseReverseQrPayload(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.reference).toBe(reference);
    expect(parsed?.token).toBe(token);
  });

  it("rejette les formats de QR non reconnus", () => {
    expect(parseReverseQrPayload("INVALID_CODE_123")).toBeNull();
    expect(parseReverseQrPayload("OFIKA-REV:ONLY_ONE_PART")).toBeNull();
    expect(parseReverseQrPayload("")).toBeNull();
  });
});

describe("MVP 1 - Nettoyage et Sécurité des Commentaires / Litiges", () => {
  it("assainit et neutralise les balises HTML et scripts anti-XSS", () => {
    const input = "   <script>alert('XSS')</script> Colis bien reçu <b>sans dommage</b> !   ";
    const cleaned = sanitizeText(input);
    expect(cleaned).not.toContain("<script>");
    expect(cleaned).not.toContain("<");
    expect(cleaned).not.toContain(">");
    expect(cleaned).toContain("Colis bien reçu");
  });

  it("retourne une chaîne vide si le texte est uniquement composé d'espaces", () => {
    expect(sanitizeText("    ")).toBe("");
  });
});

describe("MVP 1 - Dossier de Preuve PDF Cryptographique", () => {
  it("génère un fichier PDF binaire valide", () => {
    const pdfBuffer = generateProofDossierPdf({
      id: "11111111-2222-3333-4444-555555555555",
      companyName: "Pharmacie Principale Plateau",
      reference: "OFK-2026-PHARMA-0042",
      recipientName: "Dr. Yao Kouamé",
      recipientPhone: "+2250708091011",
      address: "Immeuble Trade Center, 4e étage, Plateau, Abidjan",
      district: "Plateau",
      packageDescription: "Médicaments thermo-sensibles",
      status: "DELIVERED",
      proofMode: "QR_PHOTO_SIGNATURE",
      proofMethod: "QR_PHOTO_SIGNATURE",
      amountToCollect: 35000,
      amountCollected: 35000,
      paymentMethod: "WAVE",
      paymentReference: "WAVE-TRX-987654",
      courierName: "Mamadou Koné",
      deliveredAt: new Date("2026-11-18T10:30:00Z"),
      courierPhone: "+2250700000000",
      clientLat: 5.3214,
      clientLng: -4.0156,
      clientAccuracy: 12,
      clientIp: "160.155.12.34",
      events: [
        {
          id: 1,
          eventType: "DELIVERY_CREATED",
          actorType: "USER",
          actorId: "user-1",
          serverTime: new Date("2026-11-18T09:00:00Z"),
          hash: "a".repeat(64),
          prevHash: null,
          lat: null,
          lng: null,
          ip: "160.155.12.34",
        },
        {
          id: 2,
          eventType: "STATUS_CHANGED",
          actorType: "COURIER",
          actorId: "courier-1",
          serverTime: new Date("2026-11-18T10:30:00Z"),
          hash: "b".repeat(64),
          prevHash: "a".repeat(64),
          lat: 5.3214,
          lng: -4.0156,
          ip: null,
        },
      ],
    });

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);

    const pdfHeader = pdfBuffer.subarray(0, 8).toString("latin1");
    expect(pdfHeader.startsWith("%PDF-1.4")).toBe(true);

    const pdfString = pdfBuffer.toString("latin1");
    expect(pdfString).toContain("DOSSIER DE PREUVE");
    expect(pdfString).toContain("OFK-2026-PHARMA-0042");
    expect(pdfString).toContain("Pharmacie Principale Plateau");
    expect(pdfString).toContain("Mamadou Koné");
  });
});
