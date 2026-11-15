import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "./validation";

describe("normalizePhone : un téléphone = une seule forme", () => {
  it.each([
    "07 07 07 07 07",
    "0707070707",
    "+225 07 07 07 07 07",
    "+2250707070707",
    "00225 07 07 07 07 07",
    "+225 07-07.07 07 07",
    "(+225) 0707070707",
  ])("« %s » → +2250707070707", (input) => {
    expect(normalizePhone(input)).toBe("+2250707070707");
  });

  it("garde les autres opérateurs ivoiriens et les fixes", () => {
    expect(normalizePhone("05 05 05 05 05")).toBe("+2250505050505");
    expect(normalizePhone("01 01 01 01 01")).toBe("+2250101010101");
    expect(normalizePhone("27 22 00 00 00")).toBeNull(); // fixe sans 0 initial ni indicatif : ambigu
    expect(normalizePhone("+225 27 22 00 00 00")).toBe("+2252722000000");
  });

  it("accepte un numéro étranger avec indicatif", () => {
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678");
  });

  it.each(["", "12", "abc", "07 07 07 07", "+225 07 07 07 07", "+225 07 07 07 07 07 07", "+0 1234 5678"])(
    "refuse « %s »",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe("formatPhone", () => {
  it("affiche un numéro ivoirien par paires", () => {
    expect(formatPhone("+2250707070707")).toBe("+225 07 07 07 07 07");
  });
  it("laisse un numéro étranger tel quel", () => {
    expect(formatPhone("+33612345678")).toBe("+33612345678");
  });
});
