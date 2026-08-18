"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimePostgresChangesFilter, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

/**
 * Onzichtbaar client-component dat op een Supabase Realtime-wijziging
 * (`postgres_changes`) wacht en dan `router.refresh()` aanroept, zodat een
 * Server Component-pagina zijn data opnieuw ophaalt zonder dat de gebruiker
 * hoeft te verversen. Bestaande RLS-policies gelden gewoon door — dit is
 * puur een "er is iets veranderd, haal opnieuw op"-signaal, geen extra
 * databron.
 *
 * Supabase Realtime ondersteunt maar één kolom-gelijkheidsfilter per
 * subscription (`filter`, bv. "event_id=eq.<id>"). Voor filtering op een
 * tweede kolom (bv. category_key/supplier_id binnen datzelfde event_id) geef
 * je een `guard` mee die de payload client-side controleert voordat er
 * ververst wordt.
 *
 * Doet niets als Supabase niet geconfigureerd is (bv. deze sandbox zonder
 * env-vars) — live-updates worden dan stilzwijgend overgeslagen i.p.v. een
 * crash te veroorzaken.
 */
export function RealtimeRefresh({
  table,
  filter,
  event = "*",
  guard,
}: {
  /** Naam van de Postgres-tabel (moet zijn toegevoegd aan de `supabase_realtime`-publicatie, zie migratie). */
  table: string;
  /** Server-side gelijkheidsfilter, bv. `event_id=eq.<id>`. */
  filter?: string;
  /** Welk soort wijziging relevant is — standaard alles. */
  event?: ChangeEvent;
  /** Extra client-side check; retourneer `true` om te verversen. */
  guard?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => boolean;
}) {
  const router = useRouter();
  const guardRef = useRef(guard);

  useEffect(() => {
    guardRef.current = guard;
  }, [guard]);

  useEffect(() => {
    let client;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channelName = `realtime:${table}:${filter ?? "all"}:${event}`;
    const channel = client
      .channel(channelName)
      .on(
        "postgres_changes",
        { event, schema: "public", table, filter } as RealtimePostgresChangesFilter<"*">,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (guardRef.current && !guardRef.current(payload)) return;
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [table, filter, event, router]);

  return null;
}
