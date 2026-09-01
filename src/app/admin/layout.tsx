import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/catalogues/new", label: "Create catalogue" },
  { href: "/admin/catalogues", label: "Manage catalogues" },
  { href: "/admin/inquiries", label: "Customer activity" },
  { href: "/admin/settings/whatsapp", label: "WhatsApp" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen bg-surface-muted">
      {session && (
        <aside className="relative hidden w-56 shrink-0 border-r border-border bg-surface lg:block">
          <div className="border-b border-border p-5">
            <Link href="/admin" className="text-display text-lg text-primary">
              TFRC Admin
            </Link>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-text-muted">
              Control centre
            </p>
          </div>
          <nav className="p-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-text hover:bg-surface-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="absolute bottom-0 w-full border-t border-border p-4">
            <p className="truncate text-xs text-text-muted">{session.user?.email}</p>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="mt-2 text-xs text-error hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        {session && (
          <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
            <AdminMobileNav />
            <Link
              href="/"
              className="text-sm text-text-muted hover:text-primary max-lg:ml-auto"
              target="_blank"
            >
              View site →
            </Link>
          </header>
        )}
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
