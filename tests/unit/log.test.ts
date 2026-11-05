import { describe, expect, it, vi } from "vitest";
import { errorCode, log } from "@/lib/log";

describe("logs structurés", () => {
  it("masque les secrets et tronque", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log("error", "test", { detail: "clé sb_secret_ABCDEFGHIJKLMNOP fuite", n: 3 });
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.detail).not.toContain("ABCDEFGHIJ");
    expect(line.detail).toContain("[masqué]");
    expect(line.n).toBe(3);
    spy.mockRestore();
  });
  it("extrait un code d'erreur", () => {
    expect(errorCode({ code: "PGRST116" })).toBe("PGRST116");
    expect(errorCode(new TypeError("x"))).toBe("TypeError");
    expect(errorCode(42)).toBe("unknown");
  });
});
