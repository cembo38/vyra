import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
import { CREDENTIALS_PATH } from "./global-setup";

/**
 * "Echt door de browser heen"-e2e-suite (zie vervolgplan-vyra.md). Het
 * eerste stuk hieronder bewijst het fundament: een echt, via de Supabase
 * Admin API vooraf aangemaakt testaccount kan via de normale UI inloggen,
 * een nieuw evenement starten, en een echte (AI of mock) reactie
 * terugkrijgen op het eerste bericht. De derde test bouwt hierop voort en
 * dekt de volledige kernloop tot en met een bevestigde betaling: interview
 * → AI-plan → aanvraag versturen → offerte ontvangen → offerte accepteren
 * → afrekenen.
 */

const FOLLOWUP_ANSWERS = [
  "We huren een externe locatie, willen een informele/feestelijke sfeer en een budget van ongeveer 5000 euro.",
  "Verras ons gerust met de rest — we vertrouwen op jullie aanbevelingen.",
];
const MAX_INTERVIEW_TURNS = 6;

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page).toHaveURL(/\/events$/, { timeout: 15_000 });
}

/**
 * Start een nieuw evenement vanaf /events. Er zijn twee mogelijke knoppen
 * afhankelijk van of het testaccount al evenementen heeft: de lege-staat-
 * knop "Start mijn evenement" (nul evenementen) of de kaart "Nieuw
 * evenement starten" onderaan de grid (één of meer evenementen). Beide
 * teksten komen — anders dan een `href`-locator — maar op één plek in de
 * DOM voor, ook met de altijd-gemounte NavShell-navigatie erbij (zie de
 * uitleg bij de vorige test hieronder).
 */
async function startNewEvent(page: Page) {
  const emptyStateLink = page.getByRole("link", { name: "Start mijn evenement" });
  const gridLink = page.getByRole("link", { name: "Nieuw evenement starten" });
  if (await emptyStateLink.isVisible().catch(() => false)) {
    await emptyStateLink.click();
  } else {
    await gridLink.click();
  }
  await expect(page).toHaveURL(/\/events\/new$/);
}

/**
 * Doorloopt het AI-interview tot de "Zie volledige plan"-knop verschijnt.
 * Het exacte aantal vervolgvragen ligt niet vast — een echte AI-aanroep
 * (Cem heeft een echte ANTHROPIC_API_KEY geconfigureerd) beslist zelf
 * wanneer ze genoeg weet, zie generateNextQuestion() in
 * lib/ai/interview.ts. Deze helper wacht daarom per beurt op óf een
 * nieuwe assistent-bubbel óf de plan-knop, i.p.v. een vast aantal beurten
 * te verwachten, met een ruime bovengrens als vangnet tegen een
 * eindeloze lus.
 *
 * Sinds de categorie-voorproef (Cem vroeg hierom na het "Vyra in
 * Beweging"-voorstel op de homepage) verschijnt er ná "done" éérst
 * automatisch een lichte AI-voorproef — pas zodra díe klaar is, toont de
 * knop hieronder "Zie volledige plan" i.p.v. de tussentijdse "Je plan
 * wordt opgesteld…"-staat. `planButton` wacht dus terecht op de
 * EIND-tekst, niet op het moment dat "done" zelf waar wordt.
 */
async function completeInterview(page: Page) {
  const input = page.getByPlaceholder("Typ of spreek je antwoord in…");
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill("Ik organiseer een verjaardagsfeest voor 30 gasten in Amsterdam, ergens in september.");
  await input.press("Enter");

  const planButton = page.getByRole("button", { name: "Zie volledige plan" });
  const assistantBubbles = page.locator(".rounded-tl-sm.bg-white");
  let bubbleCount = 1; // de openingsvraag "Wat wil je organiseren?" telt al mee

  for (let turn = 0; turn < MAX_INTERVIEW_TURNS; turn++) {
    await Promise.race([
      planButton.waitFor({ state: "visible", timeout: 45_000 }).catch(() => {}),
      assistantBubbles.nth(bubbleCount).waitFor({ state: "visible", timeout: 45_000 }).catch(() => {}),
    ]);
    if (await planButton.isVisible()) return;
    bubbleCount++;

    const nextInput = page.getByPlaceholder("Typ of spreek je antwoord in…");
    await nextInput.fill(FOLLOWUP_ANSWERS[turn % FOLLOWUP_ANSWERS.length]);
    await nextInput.press("Enter");
  }

  // Laatste redmiddel als de lus is opgebruikt: alsnog netjes wachten,
  // zodat een eventuele mislukking een duidelijke timeout-foutmelding
  // geeft in plaats van stilzwijgend door te lopen met een nog open
  // interview.
  await expect(planButton).toBeVisible({ timeout: 45_000 });
}

/**
 * Stuurt op de requests-pagina een aanvraag voor élke categorie die daar
 * nog "klaar om aan te vragen" staat. Elke "Bekijk aanbieders & verstuur
 * aanvraag"-knop verdwijnt zodra die kaart is ingeklapt tot een
 * bevestiging, dus simpelweg net zo lang de eerst-overgebleven knop
 * pakken totdat er geen meer over zijn — werkt ongeacht hoeveel
 * categorieën het AI-plan precies aanbeveelt/selecteert.
 */
async function sendAllAvailableRequests(page: Page) {
  const revealButton = () => page.getByRole("button", { name: "Bekijk aanbieders & verstuur aanvraag" });
  while ((await revealButton().count()) > 0) {
    await revealButton().first().click();
    const sendButton = page.getByRole("button", { name: "Stuur aanvraag" });
    await expect(sendButton).toBeVisible({ timeout: 5_000 });
    await sendButton.click();
    // Na versturen vervangt de kaart zichzelf door een bevestigingstekst —
    // de knop verdwijnt dus uit de DOM zodra de server action klaar is
    // (de demo-offertes worden synchroon gegenereerd, zie createAndSendRequest()).
    await expect(sendButton).toBeHidden({ timeout: 15_000 });
  }
}

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

    // Er staan op een vers testaccount (nog geen evenementen) meerdere
    // links naar /events/new tegelijk in de DOM: de topbar-knop, de
    // permanente zijbalk ÉN het (op desktop-breedte onzichtbare, maar wel
    // gemounte) mobiele uitschuifmenu gebruiken alledrie hetzelfde label
    // "Nieuw evenement" (zie NavShell.tsx) — een `href`-locator zou dus
    // per ongeluk de kopie in het gesloten mobiele menu kunnen raken, die
    // buiten beeld staat en dus nooit klikbaar wordt. "Start mijn
    // evenement" is de tekst van de lege-staat-knop en komt maar op één
    // plek voor, dus ondubbelzinnig.
    await page.getByRole("link", { name: "Start mijn evenement" }).click();
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
    await expect(assistantBubbles).toHaveCount(2, { timeout: 45_000 });
  });

  test("doorloopt de volledige kernloop: interview, plan, aanvraag, offerte en afrekenen", async ({ page }) => {
    // Meerdere echte AI-aanroepen (interview) + een reeks server actions na
    // elkaar duren samen ruim langer dan de standaard test-timeout van 60s
    // (zie playwright.config.ts) — vandaar deze verruiming, alleen voor
    // deze ene, langste test.
    test.setTimeout(240_000);

    await login(page, credentials);
    await startNewEvent(page);
    await completeInterview(page);

    await page.getByRole("button", { name: "Zie volledige plan" }).click();
    await expect(page).toHaveURL(/\/events\/[^/]+\/plan$/, { timeout: 20_000 });

    // De tekst bevat het aantal geselecteerde categorieën, bv. "Bevestig
    // selectie (3) en ga verder" — dat aantal ligt niet vast (AI-plan),
    // dus matchen op het vaste voorvoegsel.
    await page.getByRole("button", { name: /^Bevestig selectie/ }).click();
    await expect(page).toHaveURL(/\/events\/[^/]+\/requests$/, { timeout: 20_000 });

    await sendAllAvailableRequests(page);

    // Elke gematchte leverancier heeft onafhankelijk 85% kans op een
    // demo-offerte, en er worden meestal meerdere categorieën tegelijk
    // aangevraagd — de kans dat GEEN ENKELE categorie een offerte
    // oplevert is daarmee verwaarloosbaar klein, maar niet exact nul.
    // Een reload forceert een verse server-fetch (i.p.v. te vertrouwen op
    // de Supabase Realtime-verversing, die een aparte, minder
    // voorspelbare verbinding vergt in een teststraat) — als er dan nog
    // steeds geen offerte-link is, faalt de assertie hieronder met een
    // duidelijke, herkenbare foutmelding i.p.v. een verwarrende timeout.
    await page.reload();
    const offerLink = page.locator('a[href*="/offers/"]').first();
    await expect(offerLink).toBeVisible({ timeout: 15_000 });
    await offerLink.click();
    await expect(page).toHaveURL(/\/events\/[^/]+\/offers\/[^/]+$/, { timeout: 15_000 });

    // De swipe-weergave (standaard tabblad) is lastig automatiseerbaar
    // (drag-gebaar) — de lijstweergave heeft dezelfde acceptatieknop als
    // gewoon, aanklikbaar element, dus daar naartoe wisselen.
    await page.getByRole("button", { name: "Lijst" }).click();
    const acceptButton = page.getByRole("button", { name: "Accepteren →" }).first();
    await expect(acceptButton).toBeVisible({ timeout: 10_000 });
    await acceptButton.click();
    await expect(page).toHaveURL(/\/events\/[^/]+\/checkout\/[^/]+$/, { timeout: 15_000 });

    // De knoptekst bevat het bedrag (bv. "Bevestig €1.234,56" — sinds Vyra
    // zelf nog geen betalingen verwerkt, bevestigt dit de boeking, niet een
    // daadwerkelijke betaling, zie de checkout-pagina), dus matchen op het
    // vaste voorvoegsel.
    await page.getByRole("button", { name: /^Bevestig €/ }).click();
    await expect(page).toHaveURL(/\/events\/[^/]+\?paid=1$/, { timeout: 15_000 });
  });
});
