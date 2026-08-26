"use server";

import { getCurrentUser } from "@/lib/auth";
import { createSupplierTemplate, deleteSupplierTemplate, getSupplierAccountByOwner, listSupplierTemplates } from "@/lib/data/store";
import { SupplierTemplate, SupplierTemplateKind } from "@/lib/types";

const MAX_TITLE_LENGTH = 60;
const MAX_BODY_LENGTH = 4000;
const MAX_TEMPLATES_PER_KIND = 20;

/**
 * Gedeelde helper, zelfde vorm als requireSupplierAssistantAccess in
 * lib/actions/supplier-assistant-actions.ts: haalt de leverancier van de
 * ingelogde gebruiker op zodat elke actie hieronder altijd tegen zijn EIGEN
 * sjablonen werkt — nooit een `supplierId` die de client zelf meestuurt.
 */
async function requireSupplier() {
  const user = await getCurrentUser();
  if (!user) return null;
  return getSupplierAccountByOwner(user.id);
}

export async function listSupplierTemplatesAction(kind: SupplierTemplateKind): Promise<SupplierTemplate[]> {
  const supplier = await requireSupplier();
  if (!supplier) return [];
  return listSupplierTemplates(supplier.id, kind);
}

export async function createSupplierTemplateAction(
  kind: SupplierTemplateKind,
  title: string,
  body: string
): Promise<{ ok: boolean; template?: SupplierTemplate; error?: string }> {
  const supplier = await requireSupplier();
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  const trimmedTitle = title.trim().slice(0, MAX_TITLE_LENGTH);
  const trimmedBody = body.trim().slice(0, MAX_BODY_LENGTH);
  if (!trimmedTitle || !trimmedBody) return { ok: false, error: "Vul zowel een titel als tekst in." };

  const existing = await listSupplierTemplates(supplier.id, kind);
  if (existing.length >= MAX_TEMPLATES_PER_KIND) {
    return { ok: false, error: `Je kunt maximaal ${MAX_TEMPLATES_PER_KIND} sjablonen per soort bewaren — verwijder er eerst één.` };
  }

  const template = await createSupplierTemplate(supplier.id, kind, trimmedTitle, trimmedBody);
  if (!template) return { ok: false, error: "Opslaan is niet gelukt, probeer het nogmaals." };
  return { ok: true, template };
}

export async function deleteSupplierTemplateAction(templateId: string): Promise<{ ok: boolean; error?: string }> {
  const supplier = await requireSupplier();
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  const deleted = await deleteSupplierTemplate(templateId, supplier.id);
  if (!deleted) return { ok: false, error: "Verwijderen is niet gelukt." };
  return { ok: true };
}
