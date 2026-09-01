import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listCatalogues } from "@/services/catalogue-admin.service";
import prisma from "@/lib/db";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const [catalogues, recentImports] = await Promise.all([
    listCatalogues(true),
    prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { environment: { select: { name: true } } },
    }),
  ]);

  const totalProducts = catalogues.reduce((n, c) => n + c.productCount, 0);

  const actions = [
    {
      href: "/admin/catalogues/new",
      title: "Create catalogue",
      desc: "Name, image, description & Excel upload",
      icon: "＋",
    },
    {
      href: "/admin/catalogues",
      title: "Manage catalogue",
      desc: "Products, categories, import & CRUD",
      icon: "📦",
    },
    {
      href: "/admin/inquiries",
      title: "Customer activity",
      desc: "Cart & WhatsApp orders — download Excel",
      icon: "📋",
    },
    {
      href: "/admin/catalogues",
      title: "Edit catalogue",
      desc: "Update home page card & store branding",
      icon: "✎",
      hint: "Pick a catalogue → Edit card",
    },
  ];

  return (
    <div>
      <h1 className="text-display text-3xl text-primary">TFRC Control Centre</h1>
      <p className="mt-1 text-text-muted">
        Welcome, {session.user?.name ?? "Admin"}. Manage everything without touching code.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">Catalogues</p>
          <p className="text-3xl font-semibold text-primary">{catalogues.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">Total products</p>
          <p className="text-3xl font-semibold text-primary">{totalProducts}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">Active stores</p>
          <p className="text-3xl font-semibold text-primary">
            {catalogues.filter((c) => c.status === "ACTIVE").length}
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="rounded-xl border border-border bg-surface p-6 transition-all hover:border-primary/30 hover:shadow-md"
          >
            <span className="text-2xl">{action.icon}</span>
            <h2 className="mt-3 text-lg font-semibold text-primary">{action.title}</h2>
            <p className="mt-1 text-sm text-text-muted">{action.desc}</p>
            {action.hint && (
              <p className="mt-2 text-xs text-text-muted/80">{action.hint}</p>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-semibold text-primary">Your catalogues</h2>
          <ul className="mt-4 space-y-2">
            {catalogues.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <Link href={`/admin/catalogues/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="text-text-muted">{c.productCount} products</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-semibold text-primary">Recent imports</h2>
          {recentImports.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">No imports yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentImports.map((job) => (
                <li key={job.id} className="text-sm">
                  <span className="font-medium">{job.fileName}</span>
                  {job.environment && (
                    <span className="text-text-muted"> · {job.environment.name}</span>
                  )}
                  <span className="block text-xs text-text-muted">
                    {job.created} new · {job.updated} updated
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-10 rounded-xl border border-dashed border-border p-6">
        <h2 className="font-semibold text-primary">Quick settings</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/admin/settings/whatsapp" className="text-sm text-primary hover:underline">
            WhatsApp number & messages
          </Link>
          <Link href="/" target="_blank" className="text-sm text-primary hover:underline">
            View customer site →
          </Link>
        </div>
      </div>
    </div>
  );
}
