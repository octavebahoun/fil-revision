import { describe, expect, it } from "vitest";
import { auditCss, auditSource } from "@/lib/audit/photosensitive";

describe("audit photosensible", () => {
  it("refuse une boucle rapide sur l'opacité", () => {
    const css = `@keyframes f{0%{opacity:0}100%{opacity:1}} .x{animation: f 200ms infinite}`;
    expect(auditCss("a.css", css)).toHaveLength(1);
  });
  it("refuse une boucle rapide sur la couleur via variables", () => {
    const css = `:root{--d:100ms;--animate-flash: flash var(--d) linear infinite} @keyframes flash{to{background-color:red}}`;
    expect(auditCss("a.css", css).map((v) => v.rule)).toContain("boucle-rapide");
  });
  it("refuse 3 itérations rapides sur filter", () => {
    const css = `@keyframes b{to{filter:brightness(2)}} .x{animation: b .1s 3}`;
    expect(auditCss("a.css", css)).toHaveLength(1);
  });
  it("accepte une boucle lente (respiration 2,4 s)", () => {
    const css = `@keyframes p{50%{opacity:.7}} .x{animation: p 2400ms ease-in-out infinite}`;
    expect(auditCss("a.css", css)).toHaveLength(0);
  });
  it("accepte une boucle rapide qui ne touche que transform (spinner)", () => {
    const css = `@keyframes s{to{transform:rotate(360deg)}} .x{animation: s 300ms linear infinite}`;
    expect(auditCss("a.css", css)).toHaveLength(0);
  });
  it("accepte une animation unique rapide", () => {
    const css = `@keyframes i{from{opacity:0}} .x{animation: i 200ms both}`;
    expect(auditCss("a.css", css)).toHaveLength(0);
  });
  it("refuse blink", () => {
    expect(auditCss("a.css", `.x{text-decoration: blink}`)).toHaveLength(1);
    expect(auditCss("a.css", `@keyframes blink{to{opacity:0}}`)[0]?.rule).toBe("blink");
    expect(auditSource("a.tsx", `<blink>x</blink>`)).toHaveLength(1);
  });
  it("refuse animate-ping et animate-bounce dans le code", () => {
    expect(auditSource("a.tsx", `<div className="animate-ping" />`)).toHaveLength(1);
    expect(auditSource("a.tsx", `<div className="animate-card-in" />`)).toHaveLength(0);
  });
});

describe("analyse des déclarations complexes", () => {
  it("cubic-bezier et var() avec virgules ne cassent pas l'analyse", () => {
    const css = `@keyframes ping{75%,to{transform:scale(2);opacity:0}} :root{--animate-ping: ping 1s cubic-bezier(0, 0, .2, 1) infinite}`;
    expect(auditCss("a.css", css)).toHaveLength(0);
    const fast = `@keyframes f{to{opacity:0}} .x{animation: f 100ms cubic-bezier(0, 0, .2, 1) infinite}`;
    expect(auditCss("a.css", fast)).toHaveLength(1);
  });
});
