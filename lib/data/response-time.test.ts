import { describe, expect, it } from "vitest";
import { computeAvgResponseHours, type ResponseTimeMessage } from "@/lib/data/response-time";

/**
 * Directe aanleiding: `avg_response_hours` op leveranciersprofielen was tot
 * nu toe een handmatig ingevulde seed-waarde, nooit écht gemeten — dus
 * juist hier is het belangrijk om de teltlogica goed te dekken vóór dit
 * getal daadwerkelijk zichtbaar wordt als vertrouwenssignaal ("Reageert
 * meestal binnen X uur") op het openbare profiel.
 */
describe("computeAvgResponseHours", () => {
  it("geeft null terug zonder enige berichtgeschiedenis", () => {
    expect(computeAvgResponseHours([])).toBeNull();
  });

  it("geeft null terug voor een gesprek dat nooit is beantwoord", () => {
    const thread: ResponseTimeMessage[] = [
      { sender: "customer", createdAt: "2026-01-01T09:00:00.000Z" },
      { sender: "customer", createdAt: "2026-01-02T09:00:00.000Z" },
    ];
    expect(computeAvgResponseHours([thread])).toBeNull();
  });

  it("meet de tijd tussen bericht en eerste antwoord in hele uren", () => {
    const thread: ResponseTimeMessage[] = [
      { sender: "customer", createdAt: "2026-01-01T09:00:00.000Z" },
      { sender: "supplier", createdAt: "2026-01-01T12:00:00.000Z" },
    ];
    expect(computeAvgResponseHours([thread])).toBe(3);
  });

  it("telt een tweede organisator-bericht vóór het antwoord niet apart mee", () => {
    // Zonder deze regel zou een ongeduldig dubbel bericht de gemeten
    // reactietijd kunstmatig verlagen (klok begint bij het EERSTE
    // onbeantwoorde bericht, niet bij het laatste).
    const thread: ResponseTimeMessage[] = [
      { sender: "customer", createdAt: "2026-01-01T09:00:00.000Z" },
      { sender: "customer", createdAt: "2026-01-01T11:00:00.000Z" }, // "hallo, nog iets van gehoord?"
      { sender: "supplier", createdAt: "2026-01-01T12:00:00.000Z" },
    ];
    expect(computeAvgResponseHours([thread])).toBe(3); // 09:00 -> 12:00, niet 11:00 -> 12:00
  });

  it("levert per heen-en-weer-uitwisseling een aparte meting op binnen één gesprek", () => {
    const thread: ResponseTimeMessage[] = [
      { sender: "customer", createdAt: "2026-01-01T09:00:00.000Z" },
      { sender: "supplier", createdAt: "2026-01-01T11:00:00.000Z" }, // 2 uur
      { sender: "customer", createdAt: "2026-01-02T09:00:00.000Z" },
      { sender: "supplier", createdAt: "2026-01-02T13:00:00.000Z" }, // 4 uur
    ];
    expect(computeAvgResponseHours([thread])).toBe(3); // gemiddelde van 2 en 4
  });

  it("negeert ai_summary-berichten voor de wachtstatus", () => {
    const thread: ResponseTimeMessage[] = [
      { sender: "customer", createdAt: "2026-01-01T09:00:00.000Z" },
      { sender: "ai_summary", createdAt: "2026-01-01T09:05:00.000Z" },
      { sender: "supplier", createdAt: "2026-01-01T11:00:00.000Z" },
    ];
    expect(computeAvgResponseHours([thread])).toBe(2);
  });

  it("middelt metingen over meerdere gesprekken (threads) van dezelfde leverancier", () => {
    const threadA: ResponseTimeMessage[] = [
      { sender: "customer", createdAt: "2026-01-01T09:00:00.000Z" },
      { sender: "supplier", createdAt: "2026-01-01T10:00:00.000Z" }, // 1 uur
    ];
    const threadB: ResponseTimeMessage[] = [
      { sender: "customer", createdAt: "2026-02-01T09:00:00.000Z" },
      { sender: "supplier", createdAt: "2026-02-01T14:00:00.000Z" }, // 5 uur
    ];
    expect(computeAvgResponseHours([threadA, threadB])).toBe(3);
  });

  it("negeert een leeg gesprek (geen berichten) tussen andere gesprekken", () => {
    const empty: ResponseTimeMessage[] = [];
    const thread: ResponseTimeMessage[] = [
      { sender: "customer", createdAt: "2026-01-01T09:00:00.000Z" },
      { sender: "supplier", createdAt: "2026-01-01T10:00:00.000Z" },
    ];
    expect(computeAvgResponseHours([empty, thread])).toBe(1);
  });
});
