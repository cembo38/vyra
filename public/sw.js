// Vyra — minimale service worker, uitsluitend voor Web Push (spec-item
// #131). Bewust GEEN caching/offline-strategie hier — dit bestand regelt
// alleen de twee dingen die een push-abonnement zonder service worker
// onmogelijk maakt: (1) een binnenkomende push tonen als systeemmelding,
// ook als geen enkel Vyra-tabblad open staat, en (2) een klik daarop naar
// de juiste pagina brengen (of een al open tabblad focussen).

self.addEventListener("push", (event) => {
  let data = { title: "Vyra", body: "", href: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Onverwachte/lege payload — val terug op de standaardtekst hierboven
    // i.p.v. de hele melding te laten mislukken.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon",
      data: { href: data.href || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Al een Vyra-tabblad open? Dat focussen en daarbinnen navigeren i.p.v.
      // een nieuw tabblad te openen — voorkomt tabblad-wildgroei bij iemand
      // die meerdere meldingen kort na elkaar aantikt.
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(href);
          return;
        }
      }
      await self.clients.openWindow(href);
    })()
  );
});
