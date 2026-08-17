"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({
  name,
  required,
  minLength,
  placeholder,
  autoComplete,
}: {
  name: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        name={name}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 pr-11 text-base text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-sage"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Verberg wachtwoord" : "Toon wachtwoord"}
        className="group absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink after:absolute after:-inset-2.5 after:content-['']"
      >
        {visible ? (
          <EyeOff className="size-4 transition-transform duration-[var(--duration-swift)] ease-[var(--ease-swift)] group-hover:scale-110 group-active:scale-90" />
        ) : (
          <Eye className="size-4 transition-transform duration-[var(--duration-swift)] ease-[var(--ease-swift)] group-hover:scale-110 group-active:scale-90" />
        )}
      </button>
    </div>
  );
}
