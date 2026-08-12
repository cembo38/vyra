const MESSAGES: Record<string, string> = {
  consent: "Je moet akkoord gaan met de voorwaarden en de privacyverklaring om een account aan te maken.",
  role: "Kies minstens één optie: organisator, leverancier, of allebei.",
  password: "Kies een wachtwoord van minimaal 8 tekens.",
  missing: "Vul je e-mailadres en wachtwoord in.",
  invalid_credentials: "E-mailadres of wachtwoord is onjuist.",
  already_registered: "Er bestaat al een account met dit e-mailadres. Log hieronder in met je wachtwoord.",
  not_confirmed: "Bevestig eerst je account via de link die we je per e-mail hebben gestuurd.",
  ratelimit: "Er zijn zojuist al meerdere e-mails verstuurd naar dit adres. Wacht ongeveer een uur en probeer het dan opnieuw, of check ook je spam-map.",
  send_failed: "Dit is niet gelukt. Probeer het over een paar minuten opnieuw.",
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
