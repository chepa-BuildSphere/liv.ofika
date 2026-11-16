import { describe, expect, it } from "vitest";
import { parseCsvRows, prepareCsvImport } from "./csv-import";
import { normalizeDeliveryFilters, validateDeliveryInput } from "./deliveries";

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
    });

    const f2 = normalizeDeliveryFilters({ courierId: "UNASSIGNED", from: "2026-11-01", to: "2026-11-10" });
    expect(f2.courierId).toBe("UNASSIGNED");
    expect(f2.startUtc).toEqual(new Date("2026-11-01T00:00:00.000Z"));
    expect(f2.endExclusiveUtc).toEqual(new Date("2026-11-11T00:00:00.000Z"));
  });

  it("ignore proprement les statuts, UUID et dates invalides", () => {
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
    });
  });
});
