"use client";

import { useMemo, useState } from "react";
import { Download, Search, Trash2 } from "lucide-react";
import { formatInquiryEventLabel } from "@/lib/inquiry-types";
import { UiSelect } from "@/components/ui/UiSelect";

interface InquiryItem {
  productId: string;
  productName: string;
  price: number;
  currency: string;
  quantity: number;
  size: string | null;
}

interface InquiryRow {
  id: string;
  eventType: string;
  sessionId: string | null;
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
  referrer: string | null;
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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }

  const allVisibleSelected =
    rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        rows.forEach((row) => next.delete(row.id));
      } else {
        rows.forEach((row) => next.add(row.id));
      }
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteActivity(deleteAll: boolean) {
    const ids = [...selectedIds];
    if (!deleteAll && ids.length === 0) return;

    const confirmed = window.confirm(
      deleteAll
        ? "Permanently delete every customer activity record, including records outside the current filters? This cannot be undone."
        : `Permanently delete ${ids.length} selected activity record${
            ids.length === 1 ? "" : "s"
          }? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/admin/inquiries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteAll ? { all: true } : { ids }),
      });
      const data = (await response.json()) as { error?: string; deleted?: number };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete customer activity.");
      }

      if (deleteAll) {
        setRows([]);
        setTotal(0);
      } else {
        const deletedIds = new Set(ids);
        setRows((current) => current.filter((row) => !deletedIds.has(row.id)));
        setTotal((current) => Math.max(0, current - (data.deleted ?? ids.length)));
      }
      setSelectedIds(new Set());
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "Could not delete customer activity."
      );
    } finally {
      setDeleting(false);
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
          <UiSelect
            value={eventType}
            onValueChange={setEventType}
            ariaLabel="Filter by event"
            options={[
              { value: "", label: "All events" },
              ...eventTypes.map((type) => ({
                value: type,
                label: formatInquiryEventLabel(type),
              })),
            ]}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm sm:w-44"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted">Catalogue</label>
          <UiSelect
            value={environmentSlug}
            onValueChange={setEnvironmentSlug}
            ariaLabel="Filter by catalogue"
            options={[
              { value: "", label: "All catalogues" },
              ...catalogues.map((catalogue) => ({
                value: catalogue.slug,
                label: catalogue.name,
              })),
            ]}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm sm:w-44"
          />
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
        <button
          type="button"
          onClick={() => void deleteActivity(false)}
          disabled={deleting || selectedIds.size === 0}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete selected ({selectedIds.size})
        </button>
        <button
          type="button"
          onClick={() => void deleteActivity(true)}
          disabled={deleting || total === 0}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete all activity
        </button>
      </div>

      <p className="text-sm text-text-muted">
        {total} record{total === 1 ? "" : "s"} — page visits, cart activity and WhatsApp
        orders (admin only, invisible to customers).
      </p>
      {deleteError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {deleteError}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all visible activity"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                />
              </th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Place</th>
              <th className="px-4 py-3">Page</th>
              <th className="px-4 py-3">Cart / products</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                  No customer activity recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select activity from ${new Date(row.createdAt).toLocaleString()}`}
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {formatInquiryEventLabel(row.eventType)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">
                      {row.customerName ||
                        (row.sessionId ? `Visitor ${row.sessionId.slice(0, 8)}` : "Anonymous visitor")}
                    </p>
                    <p className="text-xs text-text-muted">{row.customerPhone || "No phone"}</p>
                    <p className="text-xs text-text-subtle">
                      {row.environmentName ?? row.environmentSlug ?? ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{formatPlace(row)}</td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="break-all text-xs font-medium text-text">
                      {row.pagePath || "—"}
                    </p>
                    {row.referrer && (
                      <p className="mt-1 line-clamp-2 break-all text-[11px] text-text-subtle">
                        From: {row.referrer}
                      </p>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    {row.items.length > 0 ? (
                      <ul className="space-y-1 text-xs">
                        {row.items.map((item) => (
                          <li key={`${row.id}-${item.productId}`}>
                            {item.productName}{" "}
                            <span className="text-text-muted">
                              ({item.size ? `Size ${item.size} · ` : ""}
                              Qty {item.quantity ?? 1} · {item.currency} {item.price.toFixed(2)})
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
