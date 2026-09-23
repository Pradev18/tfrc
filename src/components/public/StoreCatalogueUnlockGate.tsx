"use client";

import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";

export function StoreCatalogueUnlockGate({
  environmentSlug,
  environmentName,
}: {
  environmentSlug: string;
  environmentName: string;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/${encodeURIComponent(environmentSlug)}/unlock`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Incorrect catalogue password.");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock catalogue");
      setBusy(false);
    }
  }

  return (
    <div className="container-pawmart flex min-h-[55vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-[#ebe8e3] bg-white p-6 shadow-sm md:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f3f0]">
          <Lock className="h-5 w-5 text-[#141414]" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-[#141414] md:text-2xl">
          {environmentName} is locked
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6b6560]">
          Enter the catalogue password to browse products and place WhatsApp orders.
          This is the same password set when the catalogue was locked in admin.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#141414]">
              Catalogue password
            </span>
            <input
              type="password"
              name="catalogue-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              className="w-full rounded-xl border border-[#d4cfc8] bg-white px-4 py-3 text-sm text-[#141414] outline-none focus:border-[#141414]"
              placeholder="Enter password"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || password.trim().length < 4}
            className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#141414] px-6 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Unlocking…" : "Unlock catalogue"}
          </button>
        </form>
      </div>
    </div>
  );
}
