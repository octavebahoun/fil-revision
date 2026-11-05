import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { admin, login, makeUser, removeUser } from "./helpers";
import { seedDeck } from "../helpers/seed";

/**
 * Audit d'accessibilité (axe, WCAG 2.2 AA) de chaque écran : zéro violation sérieuse ou critique.
 * Avec E2E_SCREENSHOTS=dossier, capture aussi chaque écran (thème clair et sombre).
 */
const SHOTS = process.env.E2E_SCREENSHOTS;

async function audit(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  // Laisse finir les fondus d'entrée (260–420 ms) : en plein fondu, le contraste mesuré est faux.
  await page.waitForTimeout(700);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map(
    (v) =>
      `${v.id} (${v.impact}) : ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`,
  );
  expect(summary, `Violations sur ${name}`).toEqual([]);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    const project = test.info().project.name;
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(450); // fin des transitions de couleur au changement de thème
      await page.screenshot({ path: `${SHOTS}/${name}-${project}-${scheme}.png`, fullPage: true });
    }
    await page.emulateMedia({ colorScheme: "light" });
  }
}

test("écrans publics", async ({ page }) => {
  for (const [path, name] of [
    ["/connexion", "connexion"],
    ["/inscription", "inscription"],
    ["/mot-de-passe-oublie", "oubli"],
  ] as const) {
    await page.goto(path);
    await audit(page, name);
  }
});

test("écrans de l'application", async ({ page }) => {
  test.setTimeout(240_000);
  const user = await makeUser("a11y");
  try {
    const deck = await seedDeck(admin(), user.id, { notions: 3 });
    const db = admin();
    const { data: subject } = await db.from("subjects").select("slug").eq("id", deck.subjectId).single();
    const slug = subject!.slug;
    await db
      .from("exams")
      .insert({
        user_id: user.id,
        subject_id: deck.subjectId,
        title: "Partiel",
        exam_date: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
      });
    await db.from("parking").insert({ user_id: user.id, text: "Revoir les jointures" });
    const { data: code } = await db
      .from("cards")
      .insert({
        user_id: user.id,
        notion_id: deck.notions[0],
        subject_id: deck.subjectId,
        document_id: deck.documentId,
        type: "code_exercise",
        content: {
          language: "sql",
          title: "Filtrer",
          prompt: "Les étudiants ayant au moins 10.",
          starter: "",
          setup: "CREATE TABLE t (n INT);",
          solution: "SELECT n FROM t;",
          expectedOutput: "",
          hints: ["WHERE"],
        },
        source_pages: [1],
        verified: true,
      })
      .select("id")
      .single();
    await login(page, user.email, user.password);

    const routes: [string, string][] = [
      ["/", "accueil"],
      ["/matieres", "matieres"],
      [`/matieres/${slug}`, "matiere"],
      [`/matieres/${slug}/carte`, "carte-mentale"],
      [`/documents/${deck.documentId}`, "document"],
      [`/documents/${deck.documentId}/page/1`, "lecture-page"],
      [`/notions/${deck.notions[0]}`, "notion"],
      ["/reviser", "reviser"],
      ["/tuteur", "tuteur"],
      [`/feynman/${deck.notions[0]}`, "feynman"],
      ["/examens", "examens"],
      [`/examens/blanc?matiere=${slug}`, "examen-blanc"],
      ["/pensees", "pensees"],
      ["/reglages", "reglages"],
      ["/couts", "couts"],
      [`/export/${slug}`, "export"],
      [`/code/${code!.id}`, "code"],
    ];
    for (const [path, name] of routes) {
      await page.goto(path);
      await audit(page, name);
    }
    // Session : fiche, flashcard retournée, quiz avec correction, bandeau « Où j'en étais ? ».
    await page.goto("/");
    await page.getByRole("button", { name: /Réviser maintenant/ }).click();
    await expect(page).toHaveURL(/\/session\//);
    await audit(page, "session-fiche");
    await page.getByRole("button", { name: /J'ai compris/ }).click();
    await page.getByRole("button", { name: "Voir la réponse" }).click();
    await audit(page, "session-flashcard");
    await page.getByRole("button", { name: "Bien", exact: true }).click();
    const vrai = page.getByRole("button", { name: "Vrai", exact: true });
    if (await vrai.isVisible()) {
      await vrai.click();
      await audit(page, "session-correction");
    }
    await page.keyboard.press("n");
    await audit(page, "session-idee");
  } finally {
    await removeUser(user.id);
  }
});
