"use client";

import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { adminNotify } from "@/lib/admin-notify";

type Mode = "idle" | "enable" | "change" | "disable";

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
  const [adminPassword, setAdminPassword] = useState("");
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
      const action =
        mode === "enable"
          ? "enable"
          : mode === "change"
            ? "change-password"
            : "disable";
      const res = await fetch(`/api/admin/catalogues/${catalogueId}/lock`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          password,
          confirmPassword:
            mode === "enable" || mode === "change" ? confirmPassword : undefined,
          adminPassword: mode === "change" ? adminPassword : undefined,
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
      setAdminPassword("");
      setMode("idle");
      setLocalLocked(Boolean(data.isLocked));
      onChanged?.({
        isLocked: Boolean(data.isLocked),
        unlocked: data.unlocked !== false,
      });
      adminNotify(
        mode === "enable"
          ? "Catalogue locked. Password will be required next time."
          : mode === "change"
            ? "Catalogue password changed successfully."
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
              ? "Locked — password is required every time someone opens this catalogue."
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
            <>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  setMode("change");
                  setError(null);
                }}
              >
                <Lock className="h-4 w-4" />
                Change password
              </button>
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
            </>
          )}
        </div>
      </div>

      {mode !== "idle" && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-white p-3">
          <p className="text-sm text-text-muted">
            {mode === "enable"
              ? "Set a password (numbers, letters, or both — at least 4 characters)."
              : mode === "change"
                ? "First confirm your admin portal password, then choose the new catalogue password."
              : "Enter the current lock password to remove the lock."}
          </p>
          {mode === "change" && (
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              placeholder="Current admin portal password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          )}
          <input
            type="password"
            autoComplete={mode === "disable" ? "current-password" : "new-password"}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            placeholder={
              mode === "disable" ? "Current catalogue password" : "New catalogue password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {(mode === "enable" || mode === "change") && (
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
              disabled={
                busy ||
                !password.trim() ||
                ((mode === "enable" || mode === "change") && !confirmPassword.trim()) ||
                (mode === "change" && !adminPassword.trim())
              }
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void submit()}
            >
              {busy
                ? "Saving…"
                : mode === "enable"
                  ? "Turn lock on"
                  : mode === "change"
                    ? "Change password"
                    : "Remove lock"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm"
              disabled={busy}
              onClick={() => {
                setMode("idle");
                setPassword("");
                setConfirmPassword("");
                setAdminPassword("");
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
  const [ready, setReady] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeMessage, setChangeMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Clear any previous unlock cookie so every catalogue open asks again.
    void fetch(`/api/admin/catalogues/${catalogueId}/lock`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock-session" }),
    })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [catalogueId]);

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

  async function changeCataloguePassword() {
    if (changeBusy) return;
    setChangeBusy(true);
    setChangeError(null);
    setChangeMessage(null);
    try {
      const res = await fetch(`/api/admin/catalogues/${catalogueId}/lock`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-password",
          adminPassword,
          password: newPassword,
          confirmPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not change password.");
      setAdminPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangingPassword(false);
      setPassword("");
      setChangeMessage("Catalogue password updated. Enter the new password to unlock.");
      adminNotify("Catalogue password changed successfully.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not change password.";
      setChangeError(message);
      adminNotify(message);
    } finally {
      setChangeBusy(false);
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
        <strong>{catalogueName}</strong> is password protected. Enter the password every time you
        open this catalogue to manage products, import Excel, or download PDF.
      </p>
      <input
        type="password"
        autoComplete="current-password"
        className="mt-4 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
        placeholder="Lock password"
        value={password}
        disabled={!ready || busy || changeBusy}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !changingPassword) void unlock();
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {changeMessage && (
        <p role="status" className="mt-2 text-sm text-emerald-800">
          {changeMessage}
        </p>
      )}

      {/* Always visible under the lock password field — before Unlock */}
      <div className="mt-3 rounded-xl border border-amber-300 bg-white p-3">
        {!changingPassword ? (
          <button
            type="button"
            disabled={!ready || busy || changeBusy}
            className="w-full rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => {
              setChangingPassword(true);
              setChangeError(null);
              setChangeMessage(null);
              setError(null);
            }}
          >
            Change password
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-amber-950">Change catalogue password</p>
            <p className="text-sm text-amber-900">
              Enter your admin portal login password first, then the new catalogue password.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="Current admin portal password"
              value={adminPassword}
              disabled={changeBusy}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="New catalogue password"
              value={newPassword}
              disabled={changeBusy}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="Confirm new catalogue password"
              value={confirmPassword}
              disabled={changeBusy}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {changeError && (
              <p role="alert" className="text-sm text-red-700">
                {changeError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  changeBusy ||
                  !adminPassword.trim() ||
                  !newPassword.trim() ||
                  !confirmPassword.trim()
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void changeCataloguePassword()}
              >
                {changeBusy ? "Saving…" : "Save new password"}
              </button>
              <button
                type="button"
                disabled={changeBusy}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 disabled:opacity-50"
                onClick={() => {
                  setChangingPassword(false);
                  setAdminPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setChangeError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!ready || busy || changeBusy || !password.trim()}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        onClick={() => void unlock()}
      >
        {busy ? "Checking…" : ready ? "Unlock" : "Preparing…"}
      </button>
    </div>
  );
}
