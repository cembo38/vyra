"use client";

import { useState } from "react";
import { Download } from "lucide-react";

/**
 * CSV-export van boekingen (spec-item #130) — een simpele `<select>` +
 * downloadlink, geen server action nodig: de link wijst rechtstreeks naar
 * /api/supplier/orders/export (zelfde patroon als de AVG-export-link in
 * PrivacyDataSection.tsx), de gekozen jaarfilter komt gewoon in de href mee.
 */
export function SupplierOrdersExport({ years }: { years: number[] }) {
  const [year, setYear] = useState<string>("all");
  const href = year === "all" ? "/api/supplier/orders/export" : `/api/supplier/orders/export?year=${year}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={year}
        onChange={(e) => setYear(e.target.value)}
        aria-label="Filter op jaar"
        className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-sage"
      >
        <option value="all">Alle jaren</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <a
        href={href}
        className="chip-hover inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-medium text-ink-soft hover:border-sage/50 hover:text-ink"
      >
        <Download className="size-3.5" /> Download CSV
      </a>
    </div>
  );
}
