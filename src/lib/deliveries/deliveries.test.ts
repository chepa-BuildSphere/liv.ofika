import { describe, expect, it } from "vitest";
import { validateDeliveryInput } from "./deliveries";

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
