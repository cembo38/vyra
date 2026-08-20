import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const AUTH_DIR = path.resolve(__dirname, ".auth");
export const CREDENTIALS_PATH = path.join(AUTH_DIR, "test-user.json");

/**
 * Maakt vóór de e2e-tests één, al-bevestigd wegwerp-testaccount aan via de
 * Supabase Admin API (service-role sleutel) — omzeilt zo bewust de
 * e-mailbevestigingsstap (afhankelijk van Supabase's "Confirm email"-
 * instelling), die een volledig geautomatiseerde test anders zou
 * blokkeren: er is geen echte inbox om een bevestigingsmail in te lezen.
 * De test zelf logt vervolgens gewoon via de normale /login-pagina in met
 * dit account — dit bestand raakt de UI zelf niet aan, puur
 * databasevoorbereiding.
 *
 * `e2e/global-teardown.ts` verwijdert dit account (en, via `on delete
 * cascade` in het schema, alles wat de test eronder aanmaakte — profiel,
 * evenementen, etc.) weer na afloop, ook als de tests falen.
 *
 * BEWUST tegen het echte Supabase-project uit `.env.local` (geen apart
 * test-project) — Cems eigen keuze. Het e-mailadres hieronder is duidelijk
 * herkenbaar als testdata (en het `.invalid`-domein bestaat expres niet,
 * zodat er sowieso nooit per ongeluk een echte mail naartoe kan).
 */
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY ontbreken in .env.local — beide nodig om een e2e-testaccount aan te maken. Zie e2e/README.md."
    );
  }

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${runId}@e2e.vyra-test.invalid`;
  const password = `E2e-test-${runId}!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // `role` hier heeft geen effect — de `handle_new_user`-trigger
    // (supabase/migrations/0001_init.sql) leest alleen first_name/
    // last_name uit raw_user_meta_data; `profiles.role` valt altijd terug
    // op de kolomdefault 'customer'. Precies het gedrag dat deze e2e-test
    // nodig heeft (organisator-account), dus geen probleem voor dit doel
    // — wel de moeite waard om Cem apart te laten weten, want dit
    // betekent dat de rolkeuze bij /signup momenteel nergens landt.
    user_metadata: { first_name: "E2e", last_name: "Test" },
  });
  if (error || !data.user) {
    throw new Error(`Kon geen e2e-testaccount aanmaken: ${error?.message ?? "onbekende fout"}`);
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify({ userId: data.user.id, email, password }, null, 2));
}
