import { describe, expect, it } from "vitest";
import { generateSolidBrandPng, PWA_MANIFEST } from "@/lib/pwa/pwa-config";
import {
  buildReferenceQrPayload,
  encodeQrMatrix,
  parseReferenceQrPayload,
  renderQrSvg,
} from "@/lib/qr/qr-matrix";
import { parseCsvRows, prepareCsvImport } from "./csv-import";
import {
  buildClientConfirmUrl,
  describeDeliveryEvent,
  matchReturningDeliveryByScan,
  normalizeDeliveryFilters,
  normalizeGpsCoords,
  validateDeliveryInput,
  validateFailureDeclarationInput,
  validateForceDeliveredInput,
  validateReturnReceptionInput,
  type CourierReturningGroup,
} from "./deliveries";
import { renderDeliveryLabelPdf } from "./label-pdf";

describe("validateDeliveryInput", () => {
  const valid = {
    reference: "  CMD-1042 ",
    recipientName: "  Awa Koné ",
    recipientPhone: "07 07 07 07 07",
    address: " Rue des Jardins, Immeuble Bleu ",
    district: " Cocody ",
    packageDescription: " 2 paires de chaussures ",
    amountToCollect: "15000",
    comment: " Appeler avant ",
    metadata: { orderId: 1042 },
    proofMode: "QR",
  };

  it("valide une livraison complète et normalise le téléphone ivoirien", () => {
    const r = validateDeliveryInput(valid);
    expect(r).toEqual({
      ok: true,
      data: {
        reference: "CMD-1042",
        recipientName: "Awa Koné",
        recipientPhone: "+2250707070707",
        address: "Rue des Jardins, Immeuble Bleu",
        district: "Cocody",
        packageDescription: "2 paires de chaussures",
        amountToCollect: 15000,
        comment: "Appeler avant",
        metadata: { orderId: 1042 },
        proofMode: "QR",
      },
    });
  });

  it("accepte les champs facultatifs vides et un montant 0 ou entier positif", () => {
    const emptyOpt = validateDeliveryInput({
      reference: "CMD-1",
      recipientName: "Yao",
      recipientPhone: "+225 05 05 05 05 05",
      address: "Marcory Zone 4",
      district: "  ",
      packageDescription: "",
      amountToCollect: "",
      comment: null,
      proofMode: "",
    });
    expect(emptyOpt).toMatchObject({
      ok: true,
      data: {
        district: null,
        packageDescription: null,
        amountToCollect: null,
        comment: null,
        metadata: null,
        proofMode: "QR",
      },
    });

    const zero = validateDeliveryInput({
      reference: "CMD-0",
      recipientName: "Yao",
      recipientPhone: "0505050505",
      address: "Marcory Zone 4",
      amountToCollect: 0,
    });
    expect(zero).toMatchObject({ ok: true, data: { amountToCollect: 0 } });
  });

  it("refuse un montant négatif ou à virgule", () => {
    const decimal = validateDeliveryInput({ ...valid, amountToCollect: "1500.5" });
    expect(decimal.ok).toBe(false);
    if (!decimal.ok) expect(decimal.fields.amountToCollect).toBeTruthy();

    const neg = validateDeliveryInput({ ...valid, amountToCollect: -100 });
    expect(neg.ok).toBe(false);
    if (!neg.ok) expect(neg.fields.amountToCollect).toBeTruthy();
  });

  it("refuse QR_OTP tant que l'option est en maintenance dans le MVP", () => {
    const r = validateDeliveryInput({ ...valid, proofMode: "QR_OTP" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields.proofMode).toMatch(/bientôt disponible/i);
  });

  it("signale les erreurs champ par champ", () => {
    const r = validateDeliveryInput({
      reference: " ",
      recipientName: "A",
      recipientPhone: "123",
      address: "X",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.fields).sort()).toEqual(["address", "recipientName", "recipientPhone", "reference"]);
    }
  });
});

describe("parseCsvRows / prepareCsvImport", () => {
  it("supporte ; (Excel FR), , (CSV), \\t (copier-coller Excel), BOM UTF-8 et guillemets", () => {
    const semi =
      "\uFEFFRéférence;Destinataire;Téléphone;Adresse;Quartier;Montant\r\n" +
      'CMD-1;"Awa ""La Grande"" Koné";07 07 07 07 07;"Rue 12, Cocody";Cocody;15 000 F CFA\r\n';
    const rSemi = prepareCsvImport(semi);
    expect(rSemi.ok).toBe(true);
    if (rSemi.ok) {
      expect(rSemi.errors).toEqual([]);
      expect(rSemi.candidates[0].lineNumber).toBe(2);
      expect(rSemi.candidates[0].data).toMatchObject({
        reference: "CMD-1",
        recipientName: 'Awa "La Grande" Koné',
        recipientPhone: "+2250707070707",
        address: "Rue 12, Cocody",
        amountToCollect: 15000,
      });
    }

    const comma =
      'reference,destinataire,telephone,adresse\n' +
      'CMD-2,Yao,"+225 05 05 05 05 05","Marcory, Zone 4"\n';
    expect(parseCsvRows(comma).delimiter).toBe(",");
    const rComma = prepareCsvImport(comma);
    expect(rComma.ok && rComma.candidates).toHaveLength(1);

    const tsv =
      "reference\tdestinataire\ttelephone\tadresse\n" +
      "CMD-3\tKono\t0102030405\tPlateau\n";
    expect(parseCsvRows(tsv).delimiter).toBe("\t");
    const rTsv = prepareCsvImport(tsv);
    expect(rTsv.ok && rTsv.candidates).toHaveLength(1);
  });

  it("signale les colonnes obligatoires manquantes", () => {
    const r = prepareCsvImport("reference;destinataire;quartier\nCMD-1;Awa;Cocody\n");
    expect(r).toMatchObject({
      ok: false,
      code: "MISSING_COLUMNS",
      missingColumns: ["telephone", "adresse"],
    });
  });

  it("nettoie les montants formatés et refuse les décimales", () => {
    const csv =
      "Référence;Nom;Téléphone;Adresse;Montant\n" +
      "CMD-1;Awa;0707070707;Cocody;15\u00a0000 FCFA\n" +
      "CMD-2;Yao;0505050505;Marcory;1500,50\n";
    const r = prepareCsvImport(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].data.amountToCollect).toBe(15000);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ lineNumber: 3, reference: "CMD-2" });
  });

  it("détecte un doublon de référence dans le même fichier avec le numéro des deux lignes", () => {
    const csv =
      "reference;destinataire;telephone;adresse\n" +
      "CMD-10;Awa;0707070707;Cocody\n" +
      "CMD-11;Yao;0505050505;Marcory\n" +
      "CMD-10;Kono;0102030405;Plateau\n";
    const r = prepareCsvImport(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates.map((c) => c.data.reference)).toEqual(["CMD-10", "CMD-11"]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].lineNumber).toBe(4);
    expect(r.errors[0].reference).toBe("CMD-10");
    expect(r.errors[0].message).toContain("ligne 2");
  });
});

describe("normalizeDeliveryFilters", () => {
  it("accepte un statut valide, UNASSIGNED ou un UUID de livreur, et une date YYYY-MM-DD", () => {
    const courierId = "11111111-2222-3333-4444-555555555555";
    const f1 = normalizeDeliveryFilters({
      status: "ASSIGNED",
      courierId,
      date: "2026-11-15",
      reference: " CMD-1042 ",
    });
    expect(f1).toEqual({
      status: "ASSIGNED",
      courierId,
      date: "2026-11-15",
      from: "2026-11-15",
      to: "2026-11-15",
      startUtc: new Date("2026-11-15T00:00:00.000Z"),
      endExclusiveUtc: new Date("2026-11-16T00:00:00.000Z"),
      reference: "CMD-1042",
      includeTest: false,
    });

    const f2 = normalizeDeliveryFilters({ courierId: "UNASSIGNED", from: "2026-11-01", to: "2026-11-10" });
    expect(f2.courierId).toBe("UNASSIGNED");
    expect(f2.startUtc).toEqual(new Date("2026-11-01T00:00:00.000Z"));
    expect(f2.endExclusiveUtc).toEqual(new Date("2026-11-11T00:00:00.000Z"));
  });

  it("ignore proprement les statuts, UUID et dates invalides et active includeTest sur true / 1", () => {
    const f = normalizeDeliveryFilters({
      status: "STATUT_INCONNU",
      courierId: "pas-un-uuid",
      date: "2026-02-30",
      from: "pas-une-date",
      to: "2026-13-01",
      reference: "   ",
    });
    expect(f).toEqual({
      status: null,
      courierId: null,
      date: null,
      from: null,
      to: null,
      startUtc: null,
      endExclusiveUtc: null,
      reference: null,
      includeTest: false,
    });

    expect(normalizeDeliveryFilters({ includeTest: "1" }).includeTest).toBe(true);
    expect(normalizeDeliveryFilters({ includeTest: true }).includeTest).toBe(true);
    expect(normalizeDeliveryFilters({ includeTest: "0" }).includeTest).toBe(false);
  });
});

describe("describeDeliveryEvent", () => {
  const couriers = new Map([
    ["c1", "Koffi"],
    ["c2", "Awa"],
  ]);

  it("distingue création manuelle, import CSV et désaffectation", () => {
    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_CREATED",
        fromStatus: null,
        toStatus: "CREATED",
        payload: { reference: "CMD-01" },
      }),
    ).toEqual({ label: "Livraison créée", summary: "Référence CMD-01" });

    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_CREATED",
        fromStatus: null,
        toStatus: "CREATED",
        payload: { reference: "CMD-02", source: "CSV_IMPORT" },
      }),
    ).toEqual({ label: "Livraison importée (CSV)", summary: "Référence CMD-02" });

    expect(
      describeDeliveryEvent(
        {
          eventType: "DELIVERY_CREATED",
          fromStatus: "ASSIGNED",
          toStatus: "CREATED",
          payload: { previousCourierId: "c1", unassigned: true },
        },
        couriers,
      ),
    ).toEqual({ label: "Livreur retiré", summary: "Précédemment affectée à Koffi" });
  });

  it("résume les champs modifiés sur DELIVERY_UPDATED", () => {
    const d = describeDeliveryEvent({
      eventType: "DELIVERY_UPDATED",
      fromStatus: "CREATED",
      toStatus: "CREATED",
      payload: {
        before: { recipientName: "Aïcha", address: "Cocody", amountToCollect: 5000 },
        after: { recipientName: "Aïcha Koné", address: "Plateau", amountToCollect: 5000 },
      },
    });
    expect(d.label).toBe("Livraison modifiée");
    expect(d.summary).toBe("Champs modifiés : destinataire, adresse");
  });

  it("distingue affectation et réaffectation avec noms des livreurs", () => {
    expect(
      describeDeliveryEvent(
        {
          eventType: "DELIVERY_ASSIGNED",
          fromStatus: "CREATED",
          toStatus: "ASSIGNED",
          payload: { courierId: "c1", previousCourierId: null },
        },
        couriers,
      ),
    ).toEqual({ label: "Livreur affecté", summary: "Affectée à Koffi" });

    expect(
      describeDeliveryEvent(
        {
          eventType: "DELIVERY_ASSIGNED",
          fromStatus: "ASSIGNED",
          toStatus: "ASSIGNED",
          payload: { courierId: "c2", previousCourierId: "c1" },
        },
        couriers,
      ),
    ).toEqual({ label: "Livreur réaffecté", summary: "Koffi → Awa" });
  });

  it("distingue première prise en charge et nouvelle tentative après échec", () => {
    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_PICKED_UP",
        fromStatus: "ASSIGNED",
        toStatus: "PICKED_UP",
        payload: {},
      }),
    ).toEqual({ label: "Colis récupéré", summary: null });

    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_PICKED_UP",
        fromStatus: "DELIVERY_FAILED",
        toStatus: "PICKED_UP",
        payload: {},
      }),
    ).toEqual({
      label: "Nouvelle tentative de livraison",
      summary: "Colis repris en tournée après un échec",
    });
  });

  it("formate livraison normale, validation manuelle, retour et annulation", () => {
    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_DELIVERED",
        fromStatus: "ARRIVED",
        toStatus: "DELIVERED",
        payload: { proofMethod: "QR" },
      }),
    ).toEqual({ label: "Livraison effectuée", summary: "Preuve : QR code" });

    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_FORCED_DELIVERED",
        fromStatus: "ARRIVED",
        toStatus: "DELIVERED",
        payload: { proofMethod: "MANUAL", reason: "Client sans téléphone, signature papier" },
      }),
    ).toEqual({
      label: "Livraison validée manuellement",
      summary: "Motif : Client sans téléphone, signature papier",
    });

    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_CANCELLED",
        fromStatus: "CREATED",
        toStatus: "CANCELLED",
        payload: { reason: "Commande annulée par le client" },
      }),
    ).toEqual({
      label: "Livraison annulée",
      summary: "Motif : Commande annulée par le client",
    });
  });
});

describe("QR de référence et bordereau PDF (3.7)", () => {
  it("construit, parse et encode un QR de référence valide en matrice carrée", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const payload = buildReferenceQrPayload({ id, reference: "CMD-2026-0842" });
    expect(payload).toBe(`OFIKA-REF:CMD-2026-0842:${id}`);
    expect(parseReferenceQrPayload(payload)).toEqual({
      reference: "CMD-2026-0842",
      deliveryId: id,
    });
    expect(parseReferenceQrPayload("  CMD-RAW-12  ")).toEqual({
      reference: "CMD-RAW-12",
      deliveryId: null,
    });
    expect(parseReferenceQrPayload("   ")).toBeNull();

    const matrix = encodeQrMatrix(payload);
    const size = matrix.length;
    expect(size).toBeGreaterThanOrEqual(21);
    expect(matrix.every((row) => row.length === size)).toBe(true);
    // Coin haut-gauche : carré 7x7 de détection + module sombre fixe en (size - 8, 8)
    expect(matrix[0][0]).toBe(true);
    expect(matrix[3][3]).toBe(true);
    expect(matrix[1][1]).toBe(false);
    expect(matrix[size - 8][8]).toBe(true);

    const svg = renderQrSvg(payload);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("génère un bordereau PDF 1.4 complet et affiche Livré (forcé) si validation manuelle", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const pdfBytes = renderDeliveryLabelPdf({
      id,
      companyName: "Maison Kora",
      reference: "CMD-PDF-99",
      status: "DELIVERED",
      proofMethod: "MANUAL",
      proofMode: "QR",
      recipientName: "Aïcha Koné",
      recipientPhone: "+2250788990011",
      address: "Boulevard Latrille, Villa 12",
      district: "Cocody",
      packageDescription: "Coffret cosmétique",
      amountToCollect: 18500,
      comment: "Appeler à l'arrivée",
      courierName: "Koffi Kouamé",
      createdAt: new Date("2026-11-16T09:15:00Z"),
    });

    const decoded = new TextDecoder("latin1").decode(pdfBytes);
    expect(decoded.startsWith("%PDF-1.4\n")).toBe(true);
    expect(decoded.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(decoded).toContain("CMD-PDF-99");
    expect(decoded).toContain("Maison Kora");
    expect(decoded).toContain("Koffi Kouam");
    expect(decoded).toContain(`OFIKA-REF:CMD-PDF-99:${id}`);
    expect(decoded).toContain("Livré \\(forcé\\)");
    expect(decoded).not.toContain("NaN");
  });
});

describe("PWA livreur : manifest et icônes PNG (4.1)", () => {
  it("définit un manifest installable pour l'espace /livreur avec icônes 192 et 512", () => {
    expect(PWA_MANIFEST.start_url).toBe("/livreur");
    expect(PWA_MANIFEST.display).toBe("standalone");
    expect(PWA_MANIFEST.theme_color).toBe("#C2410C");
    const sizes = (PWA_MANIFEST.icons ?? []).map((i) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toContain("192x192:any");
    expect(sizes).toContain("512x512:any");
    expect(sizes).toContain("512x512:maskable");
  });

  it("génère une image PNG RGBA valide avec signature et dimensions exactes dans IHDR", () => {
    const png = generateSolidBrandPng(192);
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdrType = String.fromCharCode(png[12], png[13], png[14], png[15]);
    expect(ihdrType).toBe("IHDR");
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16, false)).toBe(192);
    expect(view.getUint32(20, false)).toBe(192);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
  });
});

describe("normalizeGpsCoords & résumé arrivée (4.4)", () => {
  it("normalise des coordonnées GPS valides et rejette absences ou bornes invalides", () => {
    expect(normalizeGpsCoords({ lat: "5.3484", lng: -4.0273, accuracy: "14.5" })).toEqual({
      lat: 5.3484,
      lng: -4.0273,
      accuracy: 14.5,
      gpsMissing: false,
    });

    expect(normalizeGpsCoords({ lat: 5.3484, lng: -4.0273, accuracy: -5 })).toEqual({
      lat: 5.3484,
      lng: -4.0273,
      accuracy: null,
      gpsMissing: false,
    });

    expect(normalizeGpsCoords({ lat: "", lng: "", accuracy: "" })).toEqual({
      lat: null,
      lng: null,
      accuracy: null,
      gpsMissing: true,
    });

    expect(normalizeGpsCoords({ lat: 95, lng: -4.02 })).toEqual({
      lat: null,
      lng: null,
      accuracy: null,
      gpsMissing: true,
    });

    expect(normalizeGpsCoords(null)).toEqual({
      lat: null,
      lng: null,
      accuracy: null,
      gpsMissing: true,
    });
  });

  it("formate DELIVERY_ARRIVED selon gpsMissing et le numéro de tentative", () => {
    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_ARRIVED",
        fromStatus: "PICKED_UP",
        toStatus: "ARRIVED",
        payload: { attemptNumber: 1, gpsMissing: false },
      }),
    ).toEqual({ label: "Livreur arrivé sur place", summary: null });

    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_ARRIVED",
        fromStatus: "PICKED_UP",
        toStatus: "ARRIVED",
        payload: { attemptNumber: 1, gpsMissing: true },
      }),
    ).toEqual({ label: "Livreur arrivé sur place", summary: "GPS absent" });

    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_ARRIVED",
        fromStatus: "PICKED_UP",
        toStatus: "ARRIVED",
        payload: { attemptNumber: 2, gpsMissing: true },
      }),
    ).toEqual({ label: "Livreur arrivé sur place", summary: "Tentative n°2 · GPS absent" });
  });
});

describe("buildClientConfirmUrl & résumé QR_GENERATED (4.5)", () => {
  it("construit l'URL de confirmation /c/<jeton> sans double slash", () => {
    expect(buildClientConfirmUrl("https://ofika.ci/", "abc_123")).toBe("https://ofika.ci/c/abc_123");
    expect(buildClientConfirmUrl("http://localhost:5000", "tok")).toBe("http://localhost:5000/c/tok");
  });

  it("distingue première génération et régénération avec révocation sur QR_GENERATED", () => {
    expect(
      describeDeliveryEvent({
        eventType: "QR_GENERATED",
        fromStatus: "ARRIVED",
        toStatus: "ARRIVED",
        payload: { revokedPreviousCount: 0 },
      }),
    ).toEqual({ label: "QR de validation généré", summary: "Valable 3 minutes" });

    expect(
      describeDeliveryEvent({
        eventType: "QR_GENERATED",
        fromStatus: "ARRIVED",
        toStatus: "ARRIVED",
        payload: { revokedPreviousCount: 1 },
      }),
    ).toEqual({
      label: "Nouveau QR de validation généré",
      summary: "Ancien QR invalidé · valable 3 minutes",
    });

    expect(
      describeDeliveryEvent({
        eventType: "QR_SCANNED",
        fromStatus: "ARRIVED",
        toStatus: "ARRIVED",
        payload: { gpsMissing: true },
      }),
    ).toEqual({
      label: "QR scanné par le destinataire",
      summary: "Code à 4 chiffres affiché · GPS absent",
    });

    expect(
      describeDeliveryEvent({
        eventType: "SAME_DEVICE_REJECTED",
        fromStatus: "ARRIVED",
        toStatus: "ARRIVED",
        payload: {},
      }),
    ).toEqual({
      label: "Scan depuis l'appareil du livreur refusé",
      summary: "Le client doit scanner depuis son propre téléphone",
    });

    expect(
      describeDeliveryEvent({
        eventType: "QR_CODE_REJECTED",
        fromStatus: "ARRIVED",
        toStatus: "ARRIVED",
        payload: { remainingAttempts: 2 },
      }),
    ).toEqual({
      label: "Code de remise incorrect",
      summary: "2 essais restants",
    });

    expect(
      describeDeliveryEvent({
        eventType: "QR_LOCKED",
        fromStatus: "ARRIVED",
        toStatus: "ARRIVED",
        payload: {},
      }),
    ).toEqual({
      label: "QR verrouillé (3 codes faux)",
      summary: "Génération d'un nouveau QR requise",
    });

    expect(
      describeDeliveryEvent({
        eventType: "SUSPICIOUS_DEVICE_REUSE",
        fromStatus: "DELIVERED",
        toStatus: "DELIVERED",
        payload: {},
      }),
    ).toEqual({
      label: "Alerte : même appareil client réutilisé",
      summary: "Même empreinte utilisée sur plusieurs livraisons du livreur",
    });
  });
});

describe("validateFailureDeclarationInput (5.1 & 5.2)", () => {
  it("accepte un motif valide sans commentaire et exige le commentaire pour OTHER", () => {
    expect(validateFailureDeclarationInput({ failureReason: "RECIPIENT_ABSENT" })).toEqual({
      ok: true,
      data: {
        failureReason: "RECIPIENT_ABSENT",
        comment: null,
        photoUrl: null,
        afterFailure: null,
      },
    });

    const missingOther = validateFailureDeclarationInput({
      failureReason: "OTHER",
      comment: "   ",
    });
    expect(missingOther.ok).toBe(false);
    if (!missingOther.ok) {
      expect(missingOther.fields.comment).toBeDefined();
    }

    const withOther = validateFailureDeclarationInput({
      failureReason: "OTHER",
      comment: "  Portail fermé, gardien injoignable ",
      afterFailure: "RETRY",
    });
    expect(withOther).toEqual({
      ok: true,
      data: {
        failureReason: "OTHER",
        comment: "Portail fermé, gardien injoignable",
        photoUrl: null,
        afterFailure: "RETRY",
      },
    });
  });

  it("refuse un motif inconnu et contrôle le format et la taille de photo", () => {
    const badReason = validateFailureDeclarationInput({ failureReason: "NOT_A_REASON" });
    expect(badReason.ok).toBe(false);
    if (!badReason.ok) {
      expect(badReason.fields.failureReason).toBeDefined();
    }

    const validDataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/";
    expect(
      validateFailureDeclarationInput({
        failureReason: "WRONG_ADDRESS",
        photoUrl: validDataUrl,
      }),
    ).toEqual({
      ok: true,
      data: {
        failureReason: "WRONG_ADDRESS",
        comment: null,
        photoUrl: validDataUrl,
        afterFailure: null,
      },
    });

    const badPhoto = validateFailureDeclarationInput({
      failureReason: "WRONG_ADDRESS",
      photoUrl: "javascript:alert(1)",
    });
    expect(badPhoto.ok).toBe(false);
    if (!badPhoto.ok) {
      expect(badPhoto.fields.photoUrl).toBeDefined();
    }

    const hugePhoto = validateFailureDeclarationInput({
      failureReason: "WRONG_ADDRESS",
      photoUrl: `data:image/jpeg;base64,${"A".repeat(700_050)}`,
    });
    expect(hugePhoto.ok).toBe(false);
    if (!hugePhoto.ok) {
      expect(hugePhoto.fields.photoUrl).toBeDefined();
    }
  });
});

describe("réception des retours et Forcer Livré (5.3, 5.4 & 5.5)", () => {
  it("valide l'état physique, le commentaire et la photo lors de la réception d'un retour", () => {
    expect(
      validateReturnReceptionInput({
        condition: "GOOD",
        comment: "  Carton intact ",
        photoUrl: "data:image/png;base64,iVBORw0KGgo=",
      }),
    ).toEqual({
      ok: true,
      data: {
        condition: "GOOD",
        comment: "Carton intact",
        photoUrl: "data:image/png;base64,iVBORw0KGgo=",
      },
    });

    const bad = validateReturnReceptionInput({
      condition: "BROKEN",
      photoUrl: "javascript:alert(1)",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.fields.condition).toBeDefined();
      expect(bad.fields.photoUrl).toBeDefined();
    }
  });

  it("valide le motif obligatoire et la pièce jointe de Forcer Livré", () => {
    expect(
      validateForceDeliveredInput({
        reason: "  Client joignable par appel, téléphone déchargé ",
        attachmentUrl: "https://example.com/preuve.png",
      }),
    ).toEqual({
      ok: true,
      data: {
        reason: "Client joignable par appel, téléphone déchargé",
        attachmentUrl: "https://example.com/preuve.png",
      },
    });

    const missing = validateForceDeliveredInput({ reason: "ok" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.fields.reason).toBeDefined();
    }
  });

  it("retrouve un colis en retour par scan QR OFIKA-REF ou par référence (insensible à la casse)", () => {
    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    const groups: CourierReturningGroup[] = [
      {
        courierId: "c-1",
        courierName: "Koffi",
        courierPhone: "+2250700000001",
        items: [
          {
            id: id1,
            reference: "CMD-RET-101",
            recipientName: "Awa",
            address: "Cocody",
            district: null,
            packageDescription: null,
            amountToCollect: null,
            courierId: "c-1",
            courierName: "Koffi",
            returnDeclaredByCourierId: "c-1",
            failureReason: "RECIPIENT_ABSENT",
            failureComment: null,
            failurePhotoUrl: null,
            failedAt: null,
            returningSince: new Date("2026-11-16T10:00:00Z"),
            canReceive: true,
            cannotReceiveReason: null,
          },
          {
            id: id2,
            reference: "CMD-RET-102",
            recipientName: "Yao",
            address: "Marcory",
            district: null,
            packageDescription: null,
            amountToCollect: null,
            courierId: "c-1",
            courierName: "Koffi",
            returnDeclaredByCourierId: "c-1",
            failureReason: "RECIPIENT_REFUSED",
            failureComment: "Colis refusé",
            failurePhotoUrl: null,
            failedAt: null,
            returningSince: new Date("2026-11-16T11:00:00Z"),
            canReceive: true,
            cannotReceiveReason: null,
          },
        ],
      },
    ];

    expect(matchReturningDeliveryByScan(groups, buildReferenceQrPayload({ id: id2, reference: "CMD-RET-102" }))?.id).toBe(
      id2,
    );
    expect(matchReturningDeliveryByScan(groups, "  cmd-ret-101 ")?.id).toBe(id1);
    expect(matchReturningDeliveryByScan(groups, "OFIKA-REF:CMD-999:99999999-9999-4999-8999-999999999999")).toBeNull();
  });

  it("formate DELIVERY_RETURN_RECEIVED avec l'état physique et le commentaire", () => {
    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_RETURN_RECEIVED",
        fromStatus: "RETURNING",
        toStatus: "RETURN_RECEIVED",
        payload: { condition: "DAMAGED", comment: "Emballage déchiré" },
      }),
    ).toEqual({
      label: "Retour réceptionné",
      summary: "État : Endommagé — Emballage déchiré",
    });

    expect(
      describeDeliveryEvent({
        eventType: "DELIVERY_RETURN_RECEIVED",
        fromStatus: "RETURNING",
        toStatus: "RETURN_RECEIVED",
        payload: null,
      }),
    ).toEqual({
      label: "Retour réceptionné",
      summary: null,
    });
  });
});
