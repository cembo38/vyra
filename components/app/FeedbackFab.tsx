"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Bug, Check, CircleHelp, LifeBuoy, Send, X } from "lucide-react";
import { submitFeedbackReportAction } from "@/lib/actions/feedback-actions";
import { Textarea } from "@/components/ui/Form";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import { FeedbackType } from "@/lib/types";

/**
 * Kleine "hulp"-knop rechtsonder op elke pagina (root layout) — Cem wil
 * vooral weten zodra iets kapot is, dus twee scherpe keuzes i.p.v. één
 * vaag "contact"-formulier: "Ik heb een vraag" en "Het werkt niet".
 * Bewust drie stappen (knop → kies type → schrijf) i.p.v. alles in één
 * paneel proppen, zodat de rustende FAB zelf zo klein en onopvallend
 * mogelijk blijft — precies wat Cem vroeg ("mooi en simplistisch zodat
 * het niet stoort"). Werkt zonder inloggen (zie migratie 0055 + de
 * publieke submitFeedbackReportAction): een bug kan overal optreden, ook
 * op de marketingpagina's waar niemand ingelogd is.
 */
export function FeedbackFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Niet op de admin-omgeving zelf — Cem hoeft zichzelf geen bug te melden.
  if (pathname?.startsWith("/admin")) return null;

  function reset() {
    setOpen(false);
    setType(null);
    setMessage("");
    setEmail("");
    setSent(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!type) return;
    if (!message.trim()) {
      setError("Schrijf eerst iets in het veld.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("type", type);
    formData.set("message", message.trim());
    formData.set("email", email.trim());
    formData.set("pagePath", pathname ?? "");

    startTransition(async () => {
      const result = await submitFeedbackReportAction(formData);
      if (result.ok) setSent(true);
      else setError(result.error ?? "Versturen is mislukt. Probeer het nog eens.");
    });
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 w-72 rounded-2xl border border-line bg-white p-4 [box-shadow:var(--shadow-pop)] sm:w-80">
          {sent ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="flex size-9 items-center justify-center rounded-full bg-success-50 text-success">
                <Check className="size-5" />
              </span>
              <p className="text-sm font-medium text-ink">Bedankt, we hebben &apos;m ontvangen!</p>
              <p className="text-xs text-ink-faint">{type === "bug" ? "We kijken er zo snel mogelijk naar." : "We reageren zodra we kunnen."}</p>
              <button type="button" onClick={reset} className="mt-1 text-xs font-medium text-clay hover:underline">
                Sluiten
              </button>
            </div>
          ) : type === null ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink">Waarmee kunnen we helpen?</h3>
                <button type="button" onClick={reset} aria-label="Sluiten" className="text-ink-faint hover:text-ink">
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setType("question")}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-sage/50 hover:bg-sage-50/50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-dark">
                    <CircleHelp className="size-4" />
                  </span>
                  <span className="text-sm text-ink">Ik heb een vraag</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType("bug")}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-danger/50 hover:bg-danger-50/50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger">
                    <Bug className="size-4" />
                  </span>
                  <span className="text-sm text-ink">Het werkt niet</span>
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setType(null)} className="text-xs font-medium text-ink-faint hover:text-ink">
                  ← Terug
                </button>
                <button type="button" onClick={reset} aria-label="Sluiten" className="text-ink-faint hover:text-ink">
                  <X className="size-4" />
                </button>
              </div>
              <h3 className="mt-1.5 text-sm font-medium text-ink">{type === "bug" ? "Wat werkt er niet?" : "Wat wil je weten?"}</h3>
              <div className="mt-2.5">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={type === "bug" ? "Beschrijf kort wat er misgaat…" : "Waar loop je tegenaan?"}
                  autoFocus
                  className="text-sm"
                />
              </div>
              <div className="mt-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Je e-mail (optioneel, voor een reactie)"
                  className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-sage"
                />
              </div>
              {error && <p className="mt-2 rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger">{error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="lift-hover mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-4 py-2.5 text-sm font-medium text-white hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? <VyraMarkSpinner className="text-base" /> : <Send className="size-4" />}
                Versturen
              </button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Hulp sluiten" : "Vraag of bug melden"}
        className="lift-hover flex size-12 items-center justify-center rounded-full bg-ink text-paper [box-shadow:var(--shadow-pop)] hover:bg-ink/90"
      >
        {open ? <X className="size-5" /> : <LifeBuoy className="size-5" />}
      </button>
    </div>
  );
}
