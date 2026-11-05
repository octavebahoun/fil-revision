import { describe, expect, it } from "vitest";
import { bearerMatches } from "@/lib/secret";
import { buildProvider, buildProviders } from "@/lib/ai/providers";
import { costUsd, priceFor } from "@/lib/ai/pricing";
import { TutorOutput, buildTutorPrompt, mockTutor } from "@/lib/ai/tasks/tutor";
import { FeynmanOutput, buildFeynmanPrompt, mockFeynman } from "@/lib/ai/tasks/feynman";
import {
  GuideOutput,
  FeedbackOutput,
  buildGuidePrompt,
  buildFeedbackPrompt,
  mockGuide,
  mockFeedback,
} from "@/lib/ai/tasks/exercise";
import { PhpReview, buildCodePrompt, buildPhpReviewPrompt, mockPhpReview } from "@/lib/ai/tasks/code";
import { buildRegeneratePrompt, mockRegenerate, regenerateSchema } from "@/lib/ai/tasks/regenerate";
import { jobConfigFromEnv } from "@/lib/jobs/types";
import { CARD_CONTENT, type CardType } from "@/lib/content/schemas";

const SOURCE =
  "[p. 2]\nUne clé primaire identifie de façon unique chaque ligne d'une table. Elle ne peut pas être nulle.";

describe("jetons de service (comparaison en temps constant)", () => {
  it("accepte le bon secret, refuse le reste", () => {
    const s = "0123456789abcdef0123456789abcdef";
    expect(bearerMatches(`Bearer ${s}`, s)).toBe(true);
    expect(bearerMatches(`Bearer ${s}`, undefined, s)).toBe(true);
    expect(bearerMatches(`Bearer faux`, s)).toBe(false);
    expect(bearerMatches(null, s)).toBe(false);
    expect(bearerMatches(`Bearer ${s}`, "court")).toBe(false);
  });
});

describe("fournisseurs et configuration", () => {
  it("construit principal puis secours, ignore les clés absentes", () => {
    const all = buildProviders({
      AI_PRIMARY_PROVIDER: "deepseek",
      AI_FALLBACK_PROVIDER: "meta",
      DEEPSEEK_API_KEY: "k",
      META_API_KEY: "k",
    });
    expect(all.map((p) => p.name)).toEqual(["deepseek", "meta"]);
    expect(all[0]!.modelFor("light")).toBe("deepseek-flash");
    expect(buildProviders({ AI_PRIMARY_PROVIDER: "deepseek", AI_FALLBACK_PROVIDER: "meta" })).toEqual([]);
    expect(buildProvider("mock", {})?.name).toBe("mock");
    expect(buildProvider("inconnu", {})).toBeNull();
  });
  it("prix surchargeables par AI_PRICING_JSON", () => {
    process.env.AI_PRICING_JSON = JSON.stringify({ "x-model": { input: 1, output: 2 } });
    expect(priceFor("x-model")).toEqual({ input: 1, output: 2 });
    expect(costUsd("x-model", 1_000_000, 1_000_000)).toBe(3);
    process.env.AI_PRICING_JSON = "pas du json";
    expect(priceFor("deepseek-flash").input).toBeGreaterThan(0);
    delete process.env.AI_PRICING_JSON;
  });
  it("seuil de confirmation et modèles selon le fournisseur", () => {
    expect(jobConfigFromEnv({ AI_PRIMARY_PROVIDER: "mock" }).models.main).toBe("mock");
    expect(jobConfigFromEnv({ AI_PRIMARY_PROVIDER: "meta" }).models.light).toContain("muse");
    expect(jobConfigFromEnv({ AI_CONFIRM_THRESHOLD_USD: "1.5" }).confirmThresholdUsd).toBe(1.5);
  });
});

describe("tuteur, Feynman, exercices : prompts et sorties simulées valides", () => {
  const sources = [{ ref: 1, title: "La clé primaire", pages: [2], text: SOURCE }];
  it("tuteur", () => {
    for (const mode of ["ask", "simpler", "example", "quiz"] as const) {
      const p = buildTutorPrompt({
        mode,
        message: "C'est quoi ?",
        history: [{ role: "user", content: "salut" }],
        sources,
      });
      expect(p.user).toContain("donnee");
      expect(TutorOutput.safeParse(mockTutor({ mode, sources })).success).toBe(true);
    }
    expect(mockTutor({ mode: "ask", sources: [] }).found).toBe(false);
    expect(TutorOutput.parse({ reply: "x", check: "Pourquoi ? Et comment ?", citations: [] }).check).toBe("Pourquoi ?");
  });
  it("Feynman : ce qui est juste et ce qui manque", () => {
    expect(buildFeynmanPrompt({ title: "T", explanation: "e", sourceText: SOURCE }).system).toContain("Feynman");
    const good = mockFeynman({
      explanation: "Une clé primaire identifie de façon unique chaque ligne d'une table.",
      sourceText: SOURCE,
    });
    expect(FeynmanOutput.safeParse(good).success).toBe(true);
    expect(good.right.length).toBeGreaterThan(0);
    expect(mockFeynman({ explanation: "Je ne sais pas trop.", sourceText: SOURCE }).right).toEqual([]);
  });
  it("aide guidée : étapes, indices, commentaire", () => {
    expect(buildGuidePrompt("Énoncé", "TP").system).toContain("JAMAIS la solution");
    expect(
      GuideOutput.safeParse(
        mockGuide("Travail à faire : analyser le besoin du client. Puis proposer un planning détaillé."),
      ).success,
    ).toBe(true);
    const step = mockGuide("Analyse le besoin du client en détail.").steps[0]!;
    expect(buildFeedbackPrompt({ statement: "x", step, answer: "y" }).user).toContain("reponse_etudiant");
    expect(FeedbackOutput.safeParse(mockFeedback("court")).success).toBe(true);
    expect(mockFeedback("une réponse assez longue pour être considérée comme partielle").status).toBe("partial");
  });
  it("code : prompt et relecture PHP", () => {
    expect(buildCodePrompt({ title: "T", sourceText: SOURCE, language: "sql" }).system).toContain("SQLite");
    expect(buildPhpReviewPrompt({ prompt: "p", expectedOutput: "o", code: "<?php" }).user).toContain("code_etudiant");
    expect(PhpReview.safeParse(mockPhpReview("<?php echo 'Bonjour Fil';", "Bonjour Fil")).success).toBe(true);
    expect(mockPhpReview("rien", "Bonjour Fil").status).toBe("partial");
  });
  it("régénération : une carte valide pour chaque type", () => {
    const input = { title: "La clé primaire", subject: "BDD", pages: [2], sourceText: SOURCE, language: "fr" as const };
    for (const type of Object.keys(CARD_CONTENT).filter((t) => t !== "code_exercise") as CardType[]) {
      expect(regenerateSchema(type).safeParse(mockRegenerate(input, type)).success, type).toBe(true);
      expect(buildRegeneratePrompt(input, type, {}, "faux").user).toContain("Signalement");
    }
  });
});
