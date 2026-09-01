"use client";

import Link from "next/link";

interface SaleFilterChipsProps {
  environmentSlug: string;
  activeSale?: boolean;
}

export function SaleFilterChips({ environmentSlug, activeSale }: SaleFilterChipsProps) {
  const base = `/${environmentSlug}/catalogue`;
  const chips = [
    { label: "All products", href: base, active: !activeSale },
    {
      label: "On sale",
      href: `${base}?sale=true&sort=discount`,
      active: activeSale,
      highlight: true,
    },
    { label: "Biggest discount", href: `${base}?sale=true&sort=discount`, active: false },
    { label: "Newest", href: `${base}?sort=newest`, active: false },
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.href}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            chip.active
              ? chip.highlight
                ? "bg-[#dc2626] text-white"
                : "bg-[#141414] text-white"
              : "border border-[#ebe8e3] bg-white text-[#141414] hover:border-[#141414]"
          }`}
        >
          {chip.label}
        </Link>
      ))}
    </div>
  );
}
