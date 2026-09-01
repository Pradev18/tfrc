import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  {
    label: "Catalogue",
    children: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/brands", label: "Brands" },
      { href: "/admin/tags", label: "Tags" },
    ],
  },
  {
    label: "Imports & Exports",
    children: [
      { href: "/admin/imports", label: "Import Products" },
      { href: "/admin/imports/history", label: "Import History" },
    ],
  },
  {
    label: "Settings",
    children: [
      { href: "/admin/settings/whatsapp", label: "WhatsApp" },
      { href: "/admin/settings/general", label: "General" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isLoginPage = false;

  return (
    <div className="flex min-h-screen bg-surface-muted">
      {session && (
        <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
          <div className="border-b border-border p-6">
            <Link href="/admin" className="text-display text-xl text-primary">
              PawMart Admin
            </Link>
          </div>
          <nav className="p-4">
            {navItems.map((item) =>
              "href" in item && item.href ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-text hover:bg-surface-muted"
                >
                  {item.label}
                </Link>
              ) : (
                <div key={item.label} className="mt-4">
                  <p className="px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {item.label}
                  </p>
                  {item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block rounded-md px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )
            )}
          </nav>
          <div className="absolute bottom-0 w-64 border-t border-border p-4">
            <p className="truncate text-xs text-text-muted">{session.user?.email}</p>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/admin/login" });
              }}
            >
              <button type="submit" className="mt-2 text-xs text-error hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </aside>
      )}

      <div className="flex-1">
        {session && (
          <header className="border-b border-border bg-surface px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-sm text-text-muted hover:text-primary" target="_blank">
                View site →
              </Link>
            </div>
          </header>
        )}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
