import { defineConfig } from "vitest/config";

/**
 * Basis test-setup (spec-item "basis geautomatiseerde tests opzetten"):
 * bewust GEEN volledige Next.js-testomgeving (jsdom/React Testing
 * Library/Playwright-in-CI) — dat is voor een project van deze omvang
 * zwaarder dan nodig en kost meer onderhoud dan het oplevert. Vitest test
 * hier puur de losstaande, kritieke business-logica (geldberekeningen,
 * validaties) die GEEN Next.js-serveromgeving nodig heeft: alles onder
 * lib/ dat "server-only" importeert (zoals lib/data/store.ts, dat een
 * live Supabase-verbinding verwacht) valt hier bewust buiten — dat wordt
 * al gedekt door `npx tsc --noEmit` + `npx next build` vóór elke release.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
