import { describe, expect, it } from "vitest";
import { slugify, validateCreateCompany } from "./create-company";

describe("slugify", () => {
  it("enlève accents, espaces et symboles", () => {
    expect(slugify("Boutique Chez Awa & Fils")).toBe("boutique-chez-awa-fils");
    expect(slugify("  Épicerie Économique d'Abobo ")).toBe("epicerie-economique-d-abobo");
  });

  it("donne un repli si rien n'est utilisable", () => {
    expect(slugify("!!!")).toBe("entreprise");
  });

  it("limite la longueur sans finir par un tiret", () => {
    const s = slugify("a".repeat(49) + " b c d e f");
    expect(s.length).toBeLessThanOrEqual(50);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("validateCreateCompany", () => {
  const ok = { companyName: "Chez Awa", adminName: "Awa Koné", adminEmail: "awa@exemple.ci" };

  it("accepte une saisie correcte, téléphones facultatifs", () => {
    expect(validateCreateCompany(ok)).toEqual({});
    expect(validateCreateCompany({ ...ok, adminPhone: "+225 07 00 00 00 00" })).toEqual({});
  });

  it("signale chaque champ invalide", () => {
    const errors = validateCreateCompany({
      companyName: " ",
      companyPhone: "abc",
      adminName: "A",
      adminEmail: "pas-un-email",
      adminPhone: "12",
    });
    expect(Object.keys(errors).sort()).toEqual(["adminEmail", "adminName", "adminPhone", "companyName", "companyPhone"]);
  });
});
