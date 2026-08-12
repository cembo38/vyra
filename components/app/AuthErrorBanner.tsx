const MESSAGES: Record<string, string> = {
  consent: "Je moet akkoord gaan met de voorwaarden en de privacyverklaring om een account aan te maken.",
  ratelimit: "Er zijn zojuist al meerdere inloglinks verstuurd naar dit e-mailadres. Wacht ongeveer een uur en probeer het dan opnieuw, of check of je al eerder een link ontving (ook in je spam-map).",
  send_failed: "Het versturen van de inloglink is niet gelukt. Probeer het over een paar minuten opnieuw.",
  "1": "Inloggen is niet gelukt. Probeer het opnieuw.",
};

export function AuthErrorBanner({ code }: { code?: string }) {
  if (!code) return null;
  const message = MESSAGES[code] ?? MESSAGES.send_failed;
  return (
    <div className="mt-4 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
      {message}
    </div>
  );
}
