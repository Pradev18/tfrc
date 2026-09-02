import { createHash } from "crypto";
import prisma from "@/lib/db";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

function hashKey(scope: "email" | "ip", value: string): string {
  return createHash("sha256")
    .update(`${scope}:${value.trim().toLowerCase()}`)
    .digest("hex");
}

function keysFor(email: string, ipAddress: string): string[] {
  return [hashKey("email", email), hashKey("ip", ipAddress)];
}

export async function isLoginBlocked(email: string, ipAddress: string): Promise<boolean> {
  const now = new Date();
  const attempts = await prisma.loginThrottle.findMany({
    where: { id: { in: keysFor(email, ipAddress) } },
    select: { lockedUntil: true },
  });
  return attempts.some((attempt) => attempt.lockedUntil && attempt.lockedUntil > now);
}

export async function recordLoginFailure(email: string, ipAddress: string): Promise<void> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - WINDOW_MS);

  for (const id of keysFor(email, ipAddress)) {
    const current = await prisma.loginThrottle.findUnique({ where: { id } });
    const resetWindow = !current || current.windowStartedAt < windowCutoff;
    const failures = resetWindow ? 1 : current.failures + 1;
    const lockedUntil =
      failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : resetWindow ? null : current?.lockedUntil;

    await prisma.loginThrottle.upsert({
      where: { id },
      create: { id, failures, windowStartedAt: now, lockedUntil },
      update: {
        failures,
        lockedUntil,
        ...(resetWindow ? { windowStartedAt: now } : {}),
      },
    });
  }
}

export async function clearLoginFailures(email: string, ipAddress: string): Promise<void> {
  await prisma.loginThrottle.deleteMany({
    where: { id: { in: keysFor(email, ipAddress) } },
  });
}
