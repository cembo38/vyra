"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { deletePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/actions/misc-actions";
import { VAPID_PUBLIC_KEY } from "@/lib/config";

/** VAPID-sleutel staat als base64url-string in de env var, maar `PushManager.subscribe` verwacht een Uint8Array — standaard conversieboilerplate voor Web Push. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type Status = "checking" | "unsupported" | "enabled" | "disabled" | "denied";

/**
 * "E-mail/push bij proactieve Enterprise-signalen" (spec-item #131) —
 * schakelt browser-pushmeldingen voor déze browser/dit apparaat in/uit.
 * Puur best-effort: als de browser dit niet ondersteunt, of de gebruiker
 * heeft meldingen ooit geweigerd, toont dit gewoon een neutrale status
 * i.p.v. een knop die toch niets zou doen.
 */
export function PushNotificationToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();
        setStatus(existing ? "enabled" : "disabled");
      } catch {
        setStatus("unsupported");
      }
    })();
  }, []);

  async function enable() {
    setError(null);
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // `as BufferSource`: TS' ingebouwde DOM-types verwachten hier een
        // Uint8Array<ArrayBuffer> i.p.v. het bredere Uint8Array<ArrayBufferLike>
        // dat `new Uint8Array(n)` oplevert — functioneel identiek, alleen de
        // generic-typing is strenger dan nodig.
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const json = subscription.toJSON();
      const result = await savePushSubscriptionAction({
        endpoint: json.endpoint ?? "",
        p256dh: json.keys?.p256dh ?? "",
        authKey: json.keys?.auth ?? "",
      });
      if (!result.ok) {
        setError(result.error ?? "Inschakelen is niet gelukt.");
        await subscription.unsubscribe();
        return;
      }
      setStatus("enabled");
    } catch {
      setError("Inschakelen is niet gelukt — probeer het nogmaals.");
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setError(null);
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscriptionAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("disabled");
    } catch {
      setError("Uitschakelen is niet gelukt — probeer het nogmaals.");
    } finally {
      setPending(false);
    }
  }

  if (status === "checking") return null;

  if (status === "unsupported") {
    return <p className="text-xs text-ink-faint">Pushmeldingen worden niet ondersteund in deze browser.</p>;
  }

  if (status === "denied") {
    return (
      <p className="text-xs text-ink-faint">
        Je hebt meldingen voor Vyra eerder geweigerd — zet dit aan via de site-instellingen van je browser (meestal via het slotje in de adresbalk) om ze weer te ontvangen.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={status === "enabled" ? disable : enable}
        className={`chip-hover inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium disabled:opacity-50 ${
          status === "enabled" ? "border-sage/40 bg-sage-50 text-sage-dark" : "border-line bg-white text-ink-soft hover:border-sage/50 hover:text-ink"
        }`}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : status === "enabled" ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
        {status === "enabled" ? "Pushmeldingen aan — op dit apparaat" : "Pushmeldingen inschakelen"}
      </button>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
