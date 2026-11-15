import { describe, expect, it } from "vitest";
import { checkPin, isWeakPin } from "./first-access";

describe("règles du code PIN livreur", () => {
  it.each(["000000", "777777", "123456", "654321", "012345", "987654", "121212", "123123", "909090"])(
    "« %s » est trop facile",
    (pin) => {
      expect(isWeakPin(pin)).toBe(true);
    },
  );

  it.each(["482913", "730158", "264017", "112358"])("« %s » est accepté", (pin) => {
    expect(isWeakPin(pin)).toBe(false);
    expect(checkPin(pin, pin)).toBeNull();
  });

  it("exige exactement 6 chiffres", () => {
    expect(checkPin("48291", "48291")).toBe("FORMAT");
    expect(checkPin("4829135", "4829135")).toBe("FORMAT");
    expect(checkPin("48a913", "48a913")).toBe("FORMAT");
  });

  it("refuse un PIN facile avant même de comparer la confirmation", () => {
    expect(checkPin("123456", "999999")).toBe("WEAK");
  });

  it("exige deux saisies identiques", () => {
    expect(checkPin("482913", "482914")).toBe("MISMATCH");
  });
});
