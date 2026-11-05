import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";

describe("limitation de débit en base", () => {
  it("bloque au-delà du maximum dans la fenêtre", async () => {
    const who = randomUUID();
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) results.push(await rateLimit("signup", who));
    expect(results.slice(0, 5).every(Boolean)).toBe(true);
    expect(results[5]).toBe(false);
  });
  it("compte séparément chaque sujet", async () => {
    expect(await rateLimit("reset", randomUUID())).toBe(true);
    expect(await rateLimit("reset", randomUUID())).toBe(true);
  });
});
