import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * End-to-end tests (e2e/) — echt door de browser heen, in tegenstelling tot
 * de bestaande vitest-tests (lib/*.test.ts) die alleen losse functies
 * controleren. Dit dekt precies het gat dat in vervolgplan-vyra.md werd
 * genoemd: "echt door de browser heen inloggen, een evenement starten, een
 * offerte accepteren".
 *
 * BEWUSTE KEUZE (in overleg met Cem): deze tests draaien tegen het ECHTE
 * Supabase-project uit `.env.local` — er is geen apart test-/staging-
 * project. `e2e/global-setup.ts` maakt daarom via de service-role-sleutel
 * een eigen, al-bevestigd wegwerp-testaccount aan (herkenbaar e-mailadres,
 * zie `E2E_TEST_EMAIL_PREFIX` daar) vóór de tests draaien, en
 * `e2e/global-teardown.ts` verwijdert dat account weer erna — zowel bij
 * slagen als falen van de tests. Er wordt dus geen productiedata van echte
 * gebruikers aangeraakt, maar er verschijnt wel kortstondig een testaccount
 * (en het evenement dat de test aanmaakt) in de database.
 *
 * `.env.local` wordt hieronder handmatig ingelezen (geen extra dotenv-
 * afhankelijkheid nodig) omdat Playwright dit — anders dan Next.js zelf —
 * niet automatisch doet.
 */
loadDotEnvLocal();

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
// Tegen een al draaiende server (bv. `npm run dev` in een ander tabblad)
// hoeft Playwright er zelf geen te starten — scheelt tijd bij herhaald
// lokaal testen. Standaard start Playwright wél zelf een productie-server
// (`next build && next start`), want dat is dichter bij hoe vyra.now er
// live uitziet dan de dev-server.
const REUSE_EXISTING_SERVER = process.env.PLAYWRIGHT_REUSE_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests delen één testaccount/-sessie via storageState — parallel zou elkaar in de weg zitten
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: REUSE_EXISTING_SERVER
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});

function loadDotEnvLocal() {
  const envPath = path.resolve(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
