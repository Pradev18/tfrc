"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/catalogues/new", label: "Create catalogue" },
  { href: "/admin/catalogues", label: "Manage catalogues" },
  { href: "/admin/inquiries", label: "Customer activity" },
  { href: "/admin/settings/whatsapp", label: "WhatsApp" },
];

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always close on navigation / desktop resize so the dim overlay cannot stick.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onResize() {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setOpen(false);
      }
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[min(100%,280px)] flex-col bg-surface shadow-xl">
              <div className="flex items-center justify-between border-b border-border p-4">
                <span className="text-lg font-semibold text-primary">TFRC Admin</span>
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
                  onClick={() => setOpen(false)}
                >
                  View customer site →
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
