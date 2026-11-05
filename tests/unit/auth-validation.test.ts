import { describe, expect, it } from "vitest";
import { EmailSchema, PasswordSchema, safeNext } from "@/lib/auth/validation";

describe("validation auth", () => {
  it("normalise l'e-mail", () => {
    expect(EmailSchema.parse("  Moi@Exemple.FR ")).toBe("moi@exemple.fr");
    expect(EmailSchema.safeParse("pas-un-mail").success).toBe(false);
  });
  it("exige 10 caractères, une lettre et un chiffre", () => {
    expect(PasswordSchema.safeParse("court1").success).toBe(false);
    expect(PasswordSchema.safeParse("sanschiffreici").success).toBe(false);
    expect(PasswordSchema.safeParse("1234567890").success).toBe(false);
    expect(PasswordSchema.safeParse("revision2026").success).toBe(true);
  });
  it("n'autorise que des redirections internes", () => {
    expect(safeNext("/matieres")).toBe("/matieres");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});
