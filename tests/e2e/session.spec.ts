import { expect, test } from "@playwright/test";
import { admin, login, makeUser, removeUser } from "./helpers";
import { seedDeck } from "../helpers/seed";

test.describe("Session de révision", () => {
  let user: Awaited<ReturnType<typeof makeUser>> | undefined;
  test.afterEach(async () => {
    await removeUser(user?.id);
    user = undefined;
  });

  const reviewsCount = async (userId: string) =>
    (await admin().from("reviews").select("id", { count: "exact", head: true }).eq("user_id", userId)).count ?? 0;

  test("absence simulée : bandeau, aucune erreur comptée, reprise exacte, rien de perdu hors ligne", async ({
    page,
    context,
  }) => {
    test.setTimeout(150_000);
    user = await makeUser("absence");
    await seedDeck(admin(), user.id);
    await login(page, user.email, user.password);

    await page.getByRole("button", { name: /Réviser maintenant/ }).click();
    await expect(page).toHaveURL(/\/session\//);
    await expect(page.getByText("1/")).toBeVisible();

    // 1. Répondre à 2 éléments : la fiche puis la flashcard.
    await page.getByRole("button", { name: /J'ai compris/ }).click();
    await expect(page.getByText(/^2\//)).toBeVisible();
    await page.getByRole("button", { name: "Voir la réponse" }).click();
    await page.getByRole("button", { name: "Bien", exact: true }).click();
    await expect(page.getByText(/^3\//)).toBeVisible();
    await expect.poll(() => reviewsCount(user!.id)).toBe(2);

    // 2. Inactif 60 s (vraies secondes) : le bandeau apparaît, aucune erreur n'est comptée.
    await page.waitForTimeout(60_000);
    const banner = page.getByRole("dialog", { name: "Où j'en étais ?" });
    await expect(banner).toBeVisible();
    expect(await reviewsCount(user.id)).toBe(2);
    const { data: wrong } = await admin().from("reviews").select("id").eq("user_id", user.id).eq("correct", false);
    expect(wrong).toEqual([]);
    await banner.getByRole("button", { name: "Reprendre" }).click();
    await expect(banner).toBeHidden();

    // 3. Fermer l'onglet puis rouvrir : la session reprend sur la même carte.
    const url = page.url();
    await page.close();
    const page2 = await context.newPage();
    await page2.goto(url);
    await expect(page2.getByRole("dialog", { name: "Où j'en étais ?" })).toBeVisible();
    await page2.getByRole("button", { name: "Reprendre" }).click();
    await expect(page2.getByText(/^3\//)).toBeVisible();

    // 4. Couper le réseau : répondre, rien n'est perdu ; synchronisation au retour.
    await context.setOffline(true);
    await expect(page2.getByText(/Hors ligne/)).toBeVisible();
    await page2.getByRole("button", { name: "Vrai", exact: true }).click();
    await expect(page2.locator("#contenu").getByText("Juste !")).toBeVisible();
    await page2.getByRole("button", { name: "Continuer" }).click();
    await expect(page2.getByText(/^4\//)).toBeVisible();
    expect(await reviewsCount(user.id)).toBe(2);
    await context.setOffline(false);
    await expect.poll(() => reviewsCount(user!.id), { timeout: 20_000 }).toBe(3);
  });

  test("« J'ai décroché » (touche D) : élément précédent réaffiché, l'erreur ne compte pas", async ({ page }) => {
    user = await makeUser("decroche");
    await seedDeck(admin(), user.id, { notions: 1 });
    await login(page, user.email, user.password);
    await page.goto("/reviser");
    await page.getByLabel(/Quiz/).check();
    await page.getByRole("button", { name: "Commencer" }).click();
    await expect(page).toHaveURL(/\/session\//);
    // Première question du mode quiz : la répondre faux (on attend qu'elle soit affichée).
    const vf = page.getByRole("button", { name: "Faux", exact: true });
    await expect(vf.or(page.getByRole("radio", { name: /Mauvaise A/ }))).toBeVisible();
    if (await vf.isVisible()) await vf.click();
    else {
      await page.getByRole("radio", { name: /Mauvaise A/ }).click();
      await page.getByRole("button", { name: "Valider" }).click();
    }
    await expect(page.locator("#contenu").getByText("Pas tout à fait.")).toBeVisible();
    await expect
      .poll(
        async () =>
          (await admin().from("reviews").select("id").eq("user_id", user!.id).eq("correct", false)).data?.length,
      )
      .toBe(1);
    await page.keyboard.press("d");
    await expect(page.getByText(/On reprend juste avant/).first()).toBeAttached();
    await expect
      .poll(async () => (await admin().from("reviews").select("outcome, undone").eq("user_id", user!.id)).data)
      .toEqual([{ outcome: "absent", undone: true }]);
  });

  test("raccourcis et mode focus", async ({ page }) => {
    user = await makeUser("focus");
    await seedDeck(admin(), user.id, { notions: 1 });
    await login(page, user.email, user.password);
    await page.getByRole("button", { name: /Réviser maintenant/ }).click();
    await expect(page).toHaveURL(/\/session\//);
    await page.keyboard.press("f");
    await expect(page.locator("html")).toHaveAttribute("data-focus-mode", "true");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText(/^2\//)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Bien", exact: true })).toBeVisible();
    await page.keyboard.press("3");
    await expect(page.getByText(/^3\//)).toBeVisible();
    await page.keyboard.press("n");
    await page.getByLabel(/Une idée en tête/).fill("Revoir la normalisation");
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await admin().from("parking").select("text").eq("user_id", user!.id)).data?.[0]?.text)
      .toBe("Revoir la normalisation");
  });
});
