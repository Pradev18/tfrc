"use client";

import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { adminNotify } from "@/lib/admin-notify";

type Mode = "idle" | "enable" | "disable";

export function CatalogueLockControls({
  catalogueId,
  isLocked,
  unlocked: _unlocked,
  onChanged,
}: {
  catalogueId: string;
  isLocked: boolean;
  unlocked: boolean;
  onChanged?: (next: { isLocked: boolean; unlocked: boolean }) => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localLocked, setLocalLocked] = useState(isLocked);

  useEffect(() => {
    setLocalLocked(isLocked);
  }, [isLocked]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const action = mode === "enable" ? "enable" : "disable";
      const res = await fetch(`/api/admin/catalogues/${catalogueId}/lock`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          password,
          confirmPassword: mode === "enable" ? confirmPassword : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        isLocked?: boolean;
        unlocked?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "Lock action failed");
      setPassword("");
      setConfirmPassword("");
      setMode("idle");
      setLocalLocked(Boolean(data.isLocked));
      onChanged?.({
        isLocked: Boolean(data.isLocked),
        unlocked: data.unlocked !== false,
      });
      adminNotify(
        mode === "enable"
          ? "Catalogue locked. Password will be required next time."
          : "Catalogue lock removed."
      );
      if (mode === "disable") {
        window.location.reload();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Lock action failed";
      setError(message);
      adminNotify(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            {localLocked ? (
              <Lock className="h-4 w-4 text-amber-700" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
            Catalogue lock
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {localLocked
              ? "Locked — manage / import / PDF need the password after this session expires."
              : "Optional. Lock this catalogue so staff must enter a password before managing it."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!localLocked ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setMode("enable");
                setError(null);
              }}
            >
              <Lock className="h-4 w-4" />
              Lock catalogue
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text"
              onClick={() => {
                setMode("disable");
                setError(null);
              }}
            >
              <Unlock className="h-4 w-4" />
              Remove lock
            </button>
          )}
        </div>
      </div>

      {mode !== "idle" && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-white p-3">
          <p className="text-sm text-text-muted">
            {mode === "enable"
              ? "Set a password (numbers, letters, or both — at least 4 characters)."
              : "Enter the current lock password to remove the lock."}
          </p>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            placeholder={mode === "enable" ? "New lock password" : "Current lock password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "enable" && (
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !password.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void submit()}
            >
              {busy ? "Saving…" : mode === "enable" ? "Turn lock on" : "Remove lock"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm"
              disabled={busy}
              onClick={() => {
                setMode("idle");
                setPassword("");
                setConfirmPassword("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function CatalogueUnlockGate({
  catalogueId,
  catalogueName,
  children,
}: {
  catalogueId: string;
  catalogueName: string;
  children: React.ReactNode;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  async function unlock() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalogues/${catalogueId}/lock`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Incorrect lock password.");
      setUnlocked(true);
      setPassword("");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unlock failed";
      setError(message);
      adminNotify(message);
    } finally {
      setBusy(false);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
      <div className="flex items-center gap-2 text-amber-950">
        <Lock className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Catalogue locked</h2>
      </div>
      <p className="mt-2 text-sm text-amber-900">
        <strong>{catalogueName}</strong> is password protected. Enter the lock password to manage
        products, import Excel, or download PDF.
      </p>
      <input
        type="password"
        autoComplete="current-password"
        className="mt-4 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
        placeholder="Lock password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void unlock();
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy || !password.trim()}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        onClick={() => void unlock()}
      >
        {busy ? "Checking…" : "Unlock"}
      </button>
    </div>
  );
}
