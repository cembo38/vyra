import { redirect } from "next/navigation";

// Leveranciers en organisatoren registreren zich nu via één gedeelde
// aanmeldpagina (met een keuze voor "organisator", "leverancier" of
// allebei) — deze URL blijft bestaan als nette doorverwijzing.
export default function SupplierSignupRedirect() {
  redirect("/signup?intent=supplier");
}
