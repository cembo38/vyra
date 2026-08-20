import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { CREDENTIALS_PATH } from "./global-setup";

/**
 * Ruimt het door `global-setup.ts` aangemaakte wegwerp-testaccount weer op
 * — Playwright roept dit altijd aan, ook als (een deel van) de tests
 * faalt, dus er blijft nooit testdata achter in Cems echte database.
 */
export default async function globalTeardown() {
  if (!fs.existsSync(CREDENTIALS_PATH)) return;
  const { userId } = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8")) as { userId: string };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceRoleKey && userId) {
    const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    // `on delete cascade` in supabase/migrations/0001_init.sql ruimt het
    // profiel en alle evenementen/aanvragen/etc. die de test aanmaakte
    // automatisch mee op zodra het auth.users-record verdwijnt.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error(`[e2e teardown] kon testaccount ${userId} niet verwijderen — handmatig opruimen in Supabase:`, error.message);
  }

  fs.rmSync(CREDENTIALS_PATH, { force: true });
}
