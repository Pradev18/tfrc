"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/catalogues/new", label: "Create catalogue" },
  { href: "/admin/catalogues", label: "Manage catalogues" },
  { href: "/admin/inquiries", label: "Customer activity" },
  { href: "/admin/settings/whatsapp", label: "WhatsApp" },
];

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="touch-target flex items-center justify-center rounded-lg border border-border bg-surface px-3"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,280px)] flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="font-display text-lg text-primary">TFRC Admin</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="touch-target flex items-center justify-center rounded-lg"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {navItems.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`mb-1 block rounded-lg px-4 py-3.5 text-sm font-medium ${
                      active ? "bg-primary text-white" : "text-text hover:bg-surface-muted"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border p-4">
              <Link
                href="/"
                target="_blank"
                className="block text-sm text-text-muted hover:text-primary"
              >
                View customer site →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
