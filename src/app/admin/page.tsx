import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProductStats } from "@/services/product.service";
import prisma from "@/lib/db";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const [stats, recentImports, recentLogs] = await Promise.all([
    getProductStats(),
    prisma.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: true },
    }),
  ]);

  const cards = [
    { label: "Total Products", value: stats.total },
    { label: "Active Products", value: stats.active },
    { label: "On Sale", value: stats.onSale },
    { label: "Out of Stock", value: stats.outOfStock },
    { label: "Categories", value: stats.categories },
    { label: "Brands", value: stats.brands },
  ];

  return (
    <div>
      <h1 className="text-display text-3xl text-primary">Dashboard</h1>
      <p className="mt-1 text-text-muted">Welcome back, {session.user?.name ?? "Admin"}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-surface p-6">
            <p className="text-sm text-text-muted">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold text-primary">Recent Imports</h2>
          {recentImports.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">No imports yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentImports.map((job) => (
                <li key={job.id} className="flex justify-between text-sm">
                  <span>{job.fileName}</span>
                  <span className="text-text-muted">
                    {job.created} created, {job.updated} updated
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold text-primary">Recent Activity</h2>
          {recentLogs.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">No activity logged yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentLogs.map((log) => (
                <li key={log.id} className="text-sm">
                  <span className="font-medium">{log.user?.name ?? "System"}</span>
                  {" — "}
                  {log.action} {log.resource}
                  <span className="block text-xs text-text-muted">
                    {log.createdAt.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
