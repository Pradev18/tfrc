"use client";

import { signIn } from "next-auth/react";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

function safeAdminCallback(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/admin";
  }

  try {
    const parsed = new URL(raw, "https://admin.local");
    if (parsed.origin !== "https://admin.local" || !parsed.pathname.startsWith("/admin")) {
      return "/admin";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/admin";
  }
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [approvalRecipients, setApprovalRecipients] = useState<string[]>([]);
  const attemptRef = useRef(0);
  const searchParams = useSearchParams();
  const callbackUrl = safeAdminCallback(searchParams.get("callbackUrl"));

  async function waitForApproval(input: {
    requestId: string;
    pollToken: string;
    grantToken: string;
    attempt: number;
  }) {
    for (let index = 0; index < 300; index += 1) {
      if (attemptRef.current !== input.attempt) return;
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));

      const res = await fetch("/api/auth/login-approval/status", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: input.requestId,
          pollToken: input.pollToken,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not check approval status.");

      if (data.status === "APPROVED") {
        const result = await signIn("credentials", {
          email,
          password,
          approvalGrant: input.grantToken,
          redirect: false,
          callbackUrl,
        });
        if (result?.error) {
          throw new Error("Approval could not be consumed. Request a new login approval.");
        }
        window.location.href = callbackUrl;
        return;
      }
      if (data.status === "EXPIRED" || data.status === "CONSUMED") {
        throw new Error("The approval request expired. Submit your login again.");
      }
    }
    throw new Error("The approval request expired. Submit your login again.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login-approval/request", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        approvalRequired?: boolean;
        requestId?: string;
        pollToken?: string;
        grantToken?: string;
        recipients?: string[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Invalid email or password");
      }
      if (data.approvalRequired === false) {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl,
        });
        if (result?.error) throw new Error("Invalid email or password");
        window.location.href = callbackUrl;
        return;
      }
      if (!data.requestId || !data.pollToken || !data.grantToken) {
        throw new Error("Login approval could not be created.");
      }

      setApprovalRecipients(
        Array.isArray(data.recipients) ? data.recipients.filter(Boolean) : []
      );
      setWaitingApproval(true);
      await waitForApproval({
        requestId: data.requestId,
        pollToken: data.pollToken,
        grantToken: data.grantToken,
        attempt,
      });
    } catch (cause) {
      if (attemptRef.current !== attempt) return;
      setError(cause instanceof Error ? cause.message : "Login approval failed");
      setWaitingApproval(false);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-display text-2xl text-primary">TFRC Admin</h1>
        <p className="mt-2 text-sm text-text-muted">Staff sign-in</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-60"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          {waitingApproval && (
            <div className="rounded-lg border border-[#d9bce2] bg-[#faf5fc] p-4 text-sm">
              <p className="font-semibold text-[#6d237d]">Approval email sent</p>
              <p className="mt-1 leading-6 text-text-muted">
                Waiting for authentication
                {approvalRecipients.length > 0
                  ? ` at ${approvalRecipients.join(", ")}`
                  : " from info@tfrcwholesale.com"}
                . This page will sign in automatically after approval.
              </p>
              <p className="mt-2 leading-6 text-text-muted">
                If nothing appears in Inbox within 1–2 minutes, check{" "}
                <strong>Spam / Junk</strong> in Hostinger webmail. Same-mailbox
                Hostinger mail is often filtered there.
              </p>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {waitingApproval
              ? "Waiting for approval…"
              : loading
                ? "Verifying credentials…"
                : "Sign In"}
          </button>
          {waitingApproval && (
            <button
              type="button"
              className="w-full rounded-md border border-border px-4 py-2 text-sm"
              onClick={() => {
                attemptRef.current += 1;
                setWaitingApproval(false);
                setLoading(false);
                setPassword("");
              }}
            >
              Cancel request
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
