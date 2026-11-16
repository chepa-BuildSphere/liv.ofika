import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  slugify,
  validateRegisterCompany,
  type RegisterCompanyInput,
} from "./register-company";

describe("register-company : validation et slug", () => {
  const validPayload: RegisterCompanyInput = {
    companyName: "Mode Abidjan Express",
    companyPhone: "+225 07 11 22 33 44",
    adminName: "Awa Touré",
    adminEmail: "awa.toure@mode-abidjan.ci",
    adminPhone: "+225 05 55 66 77 88",
    password: "PasswordSuperSecurise123!",
    passwordConfirmation: "PasswordSuperSecurise123!",
  };

  it("accepte une saisie valide complète", () => {
    const errors = validateRegisterCompany(validPayload);
    expect(errors).toEqual({});
  });

  it("accepte une saisie sans téléphones facultatifs", () => {
    const minimal: RegisterCompanyInput = {
      companyName: "Boutique Ivoire",
      adminName: "Koffi Serge",
      adminEmail: "koffi@ivoire.ci",
      password: "MonMotDePasseSolide123",
      passwordConfirmation: "MonMotDePasseSolide123",
    };
    expect(validateRegisterCompany(minimal)).toEqual({});
  });

  it("rejette un mot de passe trop court (< 10 caractères)", () => {
    const errors = validateRegisterCompany({
      ...validPayload,
      password: "court",
      passwordConfirmation: "court",
    });
    expect(errors.password).toContain(`${MIN_PASSWORD_LENGTH} caractères`);
  });

  it("rejette si les mots de passe ne correspondent pas", () => {
    const errors = validateRegisterCompany({
      ...validPayload,
      password: "PasswordSuperSecurise123!",
      passwordConfirmation: "DifferentPassword123!",
    });
    expect(errors.passwordConfirmation).toBe("Les mots de passe ne correspondent pas.");
  });

  it("rejette un e-mail invalide et des noms trop courts", () => {
    const errors = validateRegisterCompany({
      companyName: "A",
      adminName: "B",
      adminEmail: "invalide-sans-arobase",
      password: "PasswordSuperSecurise123!",
      passwordConfirmation: "PasswordSuperSecurise123!",
    });
    expect(errors.companyName).toBeDefined();
    expect(errors.adminName).toBeDefined();
    expect(errors.adminEmail).toBeDefined();
  });

  it("génère des slugs propres et valides", () => {
    expect(slugify("Boutique Chic & Éco d'Abidjan")).toBe("boutique-chic-eco-d-abidjan");
    expect(slugify("!@#$%^&*")).toBe("entreprise");
  });
});
