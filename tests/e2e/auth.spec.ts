import { expect, test } from "@playwright/test";
import { admin, login, makeUser, removeUser } from "./helpers";

test.describe("Authentification", () => {
  let user: Awaited<ReturnType<typeof makeUser>> | undefined;
  test.afterEach(async () => {
    await removeUser(user?.id);
    user = undefined;
  });

  test("une page privée redirige vers la connexion", async ({ page }) => {
    await page.goto("/matieres");
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fmatieres/);
    await expect(page.getByRole("heading", { name: "Content de te revoir" })).toBeVisible();
  });

  test("connexion puis déconnexion", async ({ page }) => {
    user = await makeUser();
    await login(page, user.email, user.password);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Plus" }).click();
    await page.getByRole("button", { name: "Me déconnecter" }).click();
    await expect(page).toHaveURL(/connexion/);
  });

  test("mauvais mot de passe : message neutre", async ({ page }) => {
    user = await makeUser();
    await page.goto("/connexion");
    await page.getByLabel("Ton e-mail").fill(user.email);
    await page.getByLabel("Ton mot de passe").fill("mauvais-mot-de-passe-1");
    await page.getByRole("button", { name: "Me connecter" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou mot de passe incorrect" })).toBeVisible();
  });

  test("inscription refusée hors liste : message neutre et aucun compte créé", async ({ page }) => {
    const email = `intrus-${Date.now()}@example.com`;
    await page.goto("/inscription");
    await page.getByLabel("Ton e-mail").fill(email);
    await page.getByLabel("Choisis un mot de passe").fill("motdepasse2026");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Si cette adresse est autorisée" })).toBeVisible();
    const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
    expect(data.users.some((u) => u.email === email)).toBe(false);
  });
});
