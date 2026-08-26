import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getGuestsForEvent,
  getOffersForEvent,
  getReviewsForOffer,
  getSupplierAccountByOwner,
  getSupplierLeads,
  getSupplierOrders,
  listEventsForUser,
} from "@/lib/data/store";

/**
 * "Zelfbedienings AVG-export" (livegang-audit) — een gebruiker kon tot nu
 * toe alleen via een handmatig verzoek aan Cem zijn eigen gegevens
 * opvragen. Deze route levert een downloadbare JSON met alles wat Vyra
 * over déze ingelogde gebruiker vasthoudt, rechtstreeks vanuit /profile of
 * /supplier/profile (zie de "Privacy & gegevens"-sectie daar).
 *
 * Bewust een vlakke, leesbare JSON i.p.v. een 1-op-1 databasedump — elke
 * sectie is al vertaald naar de velden die de gebruiker zelf herkent
 * (dezelfde `rowTo*`-functies als de rest van de app gebruikt).
 *
 * Berichten (message threads) zitten hier NIET in — die zijn verspreid
 * over elke aanvraag/categorie-combinatie zonder één centrale "alle
 * berichten van deze gebruiker"-query in de datalaag; wie dat specifiek
 * nodig heeft kan dat via Cem opvragen. Dat is een bewuste, benoemde
 * beperking van deze eerste versie — geen stille omissie.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  const events = await listEventsForUser(user.id);

  const eventsWithDetails = await Promise.all(
    events.map(async (event) => {
      const [guests, offers] = await Promise.all([getGuestsForEvent(event.id), getOffersForEvent(event.id)]);
      const acceptedOffers = offers.filter((o) => o.status === "accepted");
      const reviews = (await Promise.all(acceptedOffers.map((o) => getReviewsForOffer(o.id)))).flat().filter((r) => r.reviewerRole === "organizer");
      return {
        id: event.id,
        naam: event.name,
        type: event.type,
        datum: event.date,
        locatie: event.locationLabel,
        gasten: guests.map((g) => ({ naam: g.name, email: g.email, telefoon: g.phone, rsvpStatus: g.rsvpStatus })),
        mijnBeoordelingen: reviews.map((r) => ({ rating: r.rating, comment: r.comment, fotos: r.photoUrls, video: r.videoUrl, datum: r.createdAt })),
        aangemaaktOp: event.createdAt,
      };
    })
  );

  const supplier = await getSupplierAccountByOwner(user.id);
  let supplierData: Record<string, unknown> | null = null;
  if (supplier) {
    const [orders, leads] = await Promise.all([getSupplierOrders(supplier.id), getSupplierLeads(supplier.id)]);
    supplierData = {
      bedrijfsnaam: supplier.companyName,
      contactpersoon: supplier.contactPerson,
      categorieen: supplier.categories,
      vestigingsplaats: supplier.baseLocation,
      beschrijving: supplier.description,
      kvkNummer: supplier.kvkNumber,
      website: supplier.website,
      abonnement: supplier.subscriptionTier,
      aantalBoekingen: orders.length,
      aantalAanvragen: leads.length,
    };
  }

  const exportData = {
    metadata: {
      gegenereerdOp: new Date().toISOString(),
      opmerking: "Dit is een export van je persoonsgegevens op Vyra (AVG/GDPR-zelfbediening). Berichten (chatgesprekken) zitten hier niet in — vraag die apart aan via support als je die ook nodig hebt.",
    },
    account: {
      id: user.id,
      email: user.email,
      voornaam: user.firstName,
      achternaam: user.lastName,
      land: user.country,
      taal: user.language,
      aangemaaktOp: user.createdAt,
    },
    evenementen: eventsWithDetails,
    leverancierAccount: supplierData,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vyra-gegevens-${user.id}.json"`,
    },
  });
}
