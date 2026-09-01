"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { formatInquiryEventLabel } from "@/lib/inquiry-types";

interface InquiryItem {
  productId: string;
  productName: string;
  price: number;
  currency: string;
}

interface InquiryRow {
  id: string;
  eventType: string;
  customerName: string | null;
  customerPhone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  environmentName: string | null;
  environmentSlug: string | null;
  itemCount: number;
  estimatedTotal: number | null;
  currency: string;
  whatsappMessage: string | null;
  pagePath: string | null;
  createdAt: string;
  items: InquiryItem[];
}

interface InquiriesClientProps {
  initialRows: InquiryRow[];
  initialTotal: number;
  eventTypes: string[];
  catalogues: { slug: string; name: string }[];
}

function formatPlace(row: InquiryRow): string {
  return [row.city, row.region, row.country].filter(Boolean).join(", ") || "—";
}

export function InquiriesClient({
  initialRows,
  initialTotal,
  eventTypes,
  catalogues,
}: InquiriesClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [environmentSlug, setEnvironmentSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (eventType) params.set("eventType", eventType);
    if (environmentSlug) params.set("environmentSlug", environmentSlug);
    const qs = params.toString();
    return `/api/admin/inquiries/export${qs ? `?${qs}` : ""}`;
  }, [search, eventType, environmentSlug]);

  async function applyFilters() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (eventType) params.set("eventType", eventType);
      if (environmentSlug) params.set("environmentSlug", environmentSlug);
      params.set("pageSize", "50");
      const res = await fetch(`/api/admin/inquiries?${params.toString()}`);
      const data = await res.json();
      setRows(data.inquiries ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <label className="text-xs font-medium text-text-muted">Search</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, message, city…"
              className="w-full rounded-lg border border-border py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted">Event</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm sm:w-44"
          >
            <option value="">All events</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {formatInquiryEventLabel(type)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted">Catalogue</label>
          <select
            value={environmentSlug}
            onChange={(e) => setEnvironmentSlug(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm sm:w-44"
          >
            <option value="">All catalogues</option>
            {catalogues.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={applyFilters}
          disabled={loading}
          className="min-h-[44px] rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Loading…" : "Apply filters"}
        </button>
        <a
          href={exportUrl}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold text-primary hover:bg-surface-muted"
        >
          <Download className="h-4 w-4" />
          Download Excel
        </a>
      </div>

      <p className="text-sm text-text-muted">
        {total} record{total === 1 ? "" : "s"} — cart activity and WhatsApp orders (admin only,
        invisible to customers).
      </p>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Place</th>
              <th className="px-4 py-3">Cart / products</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                  No customer activity recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-surface-muted/50">
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {formatInquiryEventLabel(row.eventType)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{row.customerName || "—"}</p>
                    <p className="text-xs text-text-muted">{row.customerPhone || "No phone"}</p>
                    <p className="text-xs text-text-subtle">
                      {row.environmentName ?? row.environmentSlug ?? ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{formatPlace(row)}</td>
                  <td className="max-w-xs px-4 py-3">
                    {row.items.length > 0 ? (
                      <ul className="space-y-1 text-xs">
                        {row.items.map((item) => (
                          <li key={`${row.id}-${item.productId}`}>
                            {item.productName}{" "}
                            <span className="text-text-muted">
                              ({item.currency} {item.price.toFixed(2)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                    {row.estimatedTotal != null && row.itemCount > 0 && (
                      <p className="mt-1 text-xs font-medium text-primary">
                        Total: {row.currency} {row.estimatedTotal.toFixed(2)} ({row.itemCount}{" "}
                        items)
                      </p>
                    )}
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    {row.whatsappMessage ? (
                      <p className="line-clamp-4 whitespace-pre-wrap text-xs text-text-muted">
                        {row.whatsappMessage}
                      </p>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
