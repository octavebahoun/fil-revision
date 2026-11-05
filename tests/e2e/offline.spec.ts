import { expect, test } from "@playwright/test";
import { admin, login, makeUser, removeUser } from "./helpers";
import { seedDeck } from "../helpers/seed";

// Le service worker n'est actif qu'en build de production.
test.skip(!process.env.E2E_PROD_BUILD && !process.env.E2E_BASE_URL, "nécessite le build de production");

test("session complète en mode avion, puis synchronisation sans perte", async ({ page, context }) => {
  test.setTimeout(120_000);
  const user = await makeUser("avion");
  try {
    await seedDeck(admin(), user.id, { notions: 2 });
    const cspErrors: string[] = [];
    page.on(
      "console",
      (m) => m.type() === "error" && /Content Security Policy/.test(m.text()) && cspErrors.push(m.text()),
    );
    const packResponse = page.waitForResponse((r) => r.url().includes("/api/offline/pack"), { timeout: 30_000 });
    await login(page, user.email, user.password);
    // Le pack du jour est téléchargé en silence, et le service worker met la page hors ligne en cache.
    await packResponse;
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              new Promise<number>((res) => {
                const r = indexedDB.open("fil");
                r.onsuccess = () => {
                  const db = r.result;
                  if (!db.objectStoreNames.contains("daily")) return res(0);
                  const g = db.transaction("daily").objectStore("daily").get("pack");
                  g.onsuccess = () => res(g.result ? 1 : 0);
                };
                r.onerror = () => res(0);
              }),
          ),
        { timeout: 30_000 },
      )
      .toBe(1);
    await expect
      .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())), {
        timeout: 15_000,
      })
      .toBe(true);
    await page.reload();

    await context.setOffline(true);
    await page.goto("/hors-ligne");
    await page
      .getByRole("button", { name: /Réviser hors ligne|Reprendre/ })
      .first()
      .click();

    // Parcourt toute la session, hors ligne.
    for (let i = 0; i < 30; i++) {
      if (await page.getByText("C'est fait !").isVisible()) break;
      const tryClick = async (name: string | RegExp) => {
        const b = page.getByRole("button", { name, exact: typeof name === "string" });
        if (await b.first().isVisible()) {
          await b.first().click();
          return true;
        }
        return false;
      };
      if (await tryClick(/J'ai compris/)) continue;
      if (await tryClick("Voir la réponse")) {
        await tryClick("Bien");
        continue;
      }
      if (await tryClick("Vrai")) {
        await tryClick("Continuer");
        continue;
      }
      const choice = page.getByRole("radio").first();
      if (await choice.isVisible()) {
        await choice.click();
        await tryClick("Valider");
        await tryClick("Continuer");
        continue;
      }
      await page.waitForTimeout(300);
    }
    await expect(page.getByText("C'est fait !")).toBeVisible();
    expect(cspErrors).toEqual([]);
    const before = (await admin().from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id))
      .count;
    expect(before).toBe(0);

    await context.setOffline(false);
    await expect
      .poll(
        async () =>
          (await admin().from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id)).count,
        { timeout: 30_000 },
      )
      .toBeGreaterThanOrEqual(5);
    await expect
      .poll(
        async () =>
          (await admin().from("study_sessions").select("status").eq("user_id", user.id).eq("status", "done")).data
            ?.length,
        { timeout: 30_000 },
      )
      .toBe(1);
  } finally {
    await removeUser(user.id);
  }
});
