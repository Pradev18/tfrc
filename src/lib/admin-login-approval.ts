import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from "@/lib/login-throttle";

const DUMMY_PASSWORD_HASH =
  "$2b$12$CkjYPjLSdLgyQVGmHrz08eQFNTrAHVFBc3bTDHyOhCoof/Nfjgtjm";
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

export const LOGIN_APPROVAL_TTL_MS = 10 * 60 * 1000;

export type VerifiedAdminCredentials = {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
};

export function adminEmailApprovalRequired(): boolean {
  if (process.env.ADMIN_EMAIL_APPROVAL_REQUIRED === "false") return false;
  return (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_EMAIL_APPROVAL_REQUIRED === "true"
  );
}

export function loginRequestIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export function hashLoginToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newLoginToken(): string {
  return randomBytes(32).toString("base64url");
}

export function safeTokenEqual(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashLoginToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Verifies the same credentials used by NextAuth. Invalid credentials are
 * throttled and return null; callers must never send approval email on null.
 */
export async function verifyAdminCredentials(
  emailInput: string,
  passwordInput: string,
  ipAddress: string
): Promise<VerifiedAdminCredentials | null> {
  const email = String(emailInput ?? "").trim().toLowerCase();
  const password = String(passwordInput ?? "");
  if (!email || !password || email.length > 254 || password.length > 256) return null;

  if (await isLoginBlocked(email, ipAddress)) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });
  const valid = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH
  );
  const roles = user?.roles.map((assignment) => assignment.role.name) ?? [];
  const isAdmin = roles.some((role) => ADMIN_ROLES.has(role));

  if (!user || !user.isActive || !valid || !isAdmin) {
    await recordLoginFailure(email, ipAddress);
    return null;
  }

  await clearLoginFailures(email, ipAddress);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles,
  };
}

/** Atomically consumes a previously approved one-time login grant. */
export async function consumeApprovedLoginGrant(
  userId: string,
  grantToken: string
): Promise<boolean> {
  if (!grantToken || grantToken.length > 256) return false;
  const now = new Date();
  const consumed = await prisma.loginApproval.updateMany({
    where: {
      userId,
      grantTokenHash: hashLoginToken(grantToken),
      status: "APPROVED",
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      status: "CONSUMED",
      consumedAt: now,
    },
  });
  return consumed.count === 1;
}
