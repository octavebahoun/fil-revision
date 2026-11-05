import { expect, test } from "@playwright/test";
import { admin, login, makeUser, removeUser } from "./helpers";
import { seedDeck } from "../helpers/seed";

test.describe("Exercices de code (exécutés dans le navigateur)", () => {
  let user: Awaited<ReturnType<typeof makeUser>> | undefined;
  test.afterEach(async () => {
    await removeUser(user?.id);
    user = undefined;
  });

  async function seedExercise(content: Record<string, unknown>) {
    user = await makeUser("code");
    const deck = await seedDeck(admin(), user.id, { notions: 1 });
    const { data } = await admin()
      .from("cards")
      .insert({
        user_id: user.id,
        notion_id: deck.notions[0],
        subject_id: deck.subjectId,
        document_id: deck.documentId,
        type: "code_exercise",
        content,
        source_pages: [1],
        verified: true,
      })
      .select("id")
      .single();
    return data!.id as string;
  }

  test("SQL dans SQLite (WASM) : bonne et mauvaise réponse", async ({ page }) => {
    const id = await seedExercise({
      language: "sql",
      title: "Filtrer",
      prompt: "Les noms des étudiants ayant au moins 10.",
      starter: "",
      setup:
        "CREATE TABLE etudiant (nom TEXT, note INTEGER); INSERT INTO etudiant VALUES ('Alice', 15), ('Bob', 8), ('Chloé', 12);",
      solution: "SELECT nom FROM etudiant WHERE note >= 10;",
      expectedOutput: "",
      hints: ["WHERE"],
    });
    await login(page, user!.email, user!.password);
    await page.goto(`/code/${id}`);
    const editor = page.getByLabel(/Ton code/);
    await editor.fill("SELECT nom FROM etudiant");
    await page.getByRole("button", { name: "Exécuter" }).click();
    await expect(page.getByText(/Pas encore/)).toBeVisible();
    await editor.fill("SELECT nom FROM etudiant WHERE note > 9 ORDER BY nom DESC");
    await page.getByRole("button", { name: "Exécuter" }).click();
    await expect(page.getByText(/Juste !/)).toBeVisible();
  });

  test("TypeScript transpilé puis exécuté dans une iframe isolée", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const id = await seedExercise({
      language: "ts",
      title: "Double",
      prompt: "Affiche double(21).",
      starter: "",
      setup: "",
      solution: "function double(n: number): number { return n * 2; }\nconsole.log(double(21));",
      expectedOutput: "42",
      hints: [],
    });
    await login(page, user!.email, user!.password);
    await page.goto(`/code/${id}`);
    await page.getByLabel(/Ton code/).fill("const double = (n: number) => n * 2;\nconsole.log(double(21));");
    await page.getByRole("button", { name: "Exécuter" }).click();
    await expect(page.getByText(/Juste !/)).toBeVisible();
    await page.getByLabel(/Ton code/).fill("while (true) {}");
    await page.getByRole("button", { name: "Exécuter" }).click();
    await expect(page.getByText(/plus de 3 secondes/)).toBeVisible({ timeout: 10_000 });
    expect(errors.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
  });
});
