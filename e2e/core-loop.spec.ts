import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { CREDENTIALS_PATH } from "./global-setup";

/**
 * Eerste bouwsteen van de "echt door de browser heen"-e2e-suite (zie
 * vervolgplan-vyra.md). Dekt bewust nog NIET de volledige kernloop tot en
 * met een geaccepteerde offerte — dat vraagt om het scripten van de
 * meerstaps AI-interview tot "klaar", de planpagina, en de
 * requirements-/shortlist-/offertepagina's, die stuk voor stuk hun eigen
 * zorgvuldige selector-review verdienen. Dit eerste stuk bewijst wél het
 * fundament: een echt, via de Supabase Admin API vooraf aangemaakt
 * testaccount kan via de normale UI inloggen, een nieuw evenement starten,
 * en een echte (AI of mock, zie `usedAI`) reactie terugkrijgen op het
 * eerste bericht. Uitbreiden naar de rest van de kernloop is de logische
 * vervolgstap.
 */

test.describe("Kernloop: inloggen en een evenement starten", () => {
  let credentials: { email: string; password: string };

  test.beforeAll(() => {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  });

  test("logt in met het testaccount en komt op /events terecht", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(credentials.email);
    await page.locator('input[name="password"]').fill(credentials.password);
    await page.getByRole("button", { name: "Inloggen" }).click();

    await expect(page).toHaveURL(/\/events$/, { timeout: 15_000 });
  });

  test("start een nieuw evenement en krijgt een reactie op het eerste bericht", async ({ page }) => {
    // Los van de vorige test ingelogd (elke test krijgt een schone
    // browsercontext) — vandaar hier opnieuw de login-stap.
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(credentials.email);
    await page.locator('input[name="password"]').fill(credentials.password);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await expect(page).toHaveURL(/\/events$/, { timeout: 15_000 });

    // Zowel de topbar-knop als de lege-staat-kaart linken naar
    // /events/new — op een vers testaccount (nog geen evenementen) staan
    // ze allebei op de pagina, dus `.first()` om niet-strikte-mode-
    // ambiguïteit te voorkomen.
    await page.locator('a[href="/events/new"]').first().click();
    await expect(page).toHaveURL(/\/events\/new$/);

    const input = page.getByPlaceholder("Typ of spreek je antwoord in…");
    await expect(input).toBeVisible({ timeout: 15_000 });

    await input.fill("Ik organiseer een verjaardagsfeest voor 30 gasten in Amsterdam, ergens in september.");
    await input.press("Enter");

    // Een echte AI-aanroep kan een aantal seconden duren — ruime timeout.
    // We controleren bewust GEEN exacte tekst (die verschilt tussen de
    // echte AI en de mock-fallback), alleen dat er een nieuwe
    // assistent-reactie bijkomt na het versturen.
    const assistantBubbles = page.locator(".rounded-tl-sm.bg-white");
    await expect(assistantBubbles).toHaveCount(2, { timeout: 30_000 });
  });
});
