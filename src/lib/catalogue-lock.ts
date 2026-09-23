import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

const UNLOCK_TTL_MS = 2 * 60 * 60 * 1000; // only while actively managing this visit
const MIN_PASSWORD_LEN = 4;
const MAX_PASSWORD_LEN = 128;

type LockSettings = {
  enabled?: boolean;
  passwordHash?: string;
  updatedAt?: string;
};

function parseSettings(raw: string | null | undefined): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readLock(settings: Record<string, unknown>): LockSettings {
  const lock = settings.lock;
  if (!lock || typeof lock !== "object") return {};
  return lock as LockSettings;
}

function secret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "vitanova-catalogue-lock-dev-secret"
  );
}

export function validateCatalogueLockPassword(password: string): string | null {
  const value = String(password ?? "");
  if (value.length < MIN_PASSWORD_LEN) {
    return `Password must be at least ${MIN_PASSWORD_LEN} characters (letters, numbers, or both).`;
  }
  if (value.length > MAX_PASSWORD_LEN) {
    return `Password must be at most ${MAX_PASSWORD_LEN} characters.`;
  }
  return null;
}

export function isCatalogueLockedFromSettings(settingsJson: string | null | undefined): boolean {
  const lock = readLock(parseSettings(settingsJson));
  return Boolean(lock.enabled && lock.passwordHash);
}

export async function getCatalogueLockState(catalogueId: string): Promise<{
  exists: boolean;
  isLocked: boolean;
}> {
  const env = await prisma.environment.findUnique({
    where: { id: catalogueId },
    select: { id: true, settings: true },
  });
  if (!env) return { exists: false, isLocked: false };
  return { exists: true, isLocked: isCatalogueLockedFromSettings(env.settings) };
}

export function stripCatalogueLockSecrets<T extends { settings?: string | null }>(
  catalogue: T
): T & { isLocked: boolean } {
  const settings = parseSettings(catalogue.settings);
  const isLocked = isCatalogueLockedFromSettings(catalogue.settings ?? null);
  if (settings.lock && typeof settings.lock === "object") {
    const lock = { ...(settings.lock as LockSettings) };
    delete lock.passwordHash;
    settings.lock = { enabled: Boolean(lock.enabled), updatedAt: lock.updatedAt };
  }
  return {
    ...catalogue,
    settings: JSON.stringify(settings),
    isLocked,
  };
}

function cookieName(catalogueId: string): string {
  return `cat_ul_${catalogueId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48)}`;
}

function lockVersionFromSettings(settingsJson: string | null | undefined): string {
  const lock = readLock(parseSettings(settingsJson));
  return String(lock.updatedAt || "");
}

function signUnlockToken(
  catalogueId: string,
  expiresAt: number,
  lockVersion: string
): string {
  const payload = `${catalogueId}.${expiresAt}.${lockVersion}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${expiresAt}.${sig}`;
}

function verifyUnlockToken(
  catalogueId: string,
  token: string | undefined,
  lockVersion: string
): boolean {
  if (!token) return false;
  const [expRaw, sig] = token.split(".");
  const expiresAt = Number(expRaw);
  if (!expRaw || !sig || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = createHmac("sha256", secret())
    .update(`${catalogueId}.${expiresAt}.${lockVersion}`)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function hasCatalogueUnlockCookie(catalogueId: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(cookieName(catalogueId))?.value;
  if (!token) return false;

  const env = await prisma.environment.findUnique({
    where: { id: catalogueId },
    select: { settings: true },
  });
  if (!env) return false;

  const lock = readLock(parseSettings(env.settings));
  // Lock removed → treat as unlocked for everyone immediately.
  if (!lock.enabled || !lock.passwordHash) return true;

  // Cookie must match current lock version so password changes invalidate old sessions.
  return verifyUnlockToken(catalogueId, token, lockVersionFromSettings(env.settings));
}

export function applyCatalogueUnlockCookie(
  res: NextResponse,
  catalogueId: string,
  lockVersion = ""
) {
  const expiresAt = Date.now() + UNLOCK_TTL_MS;
  res.cookies.set(
    cookieName(catalogueId),
    signUnlockToken(catalogueId, expiresAt, lockVersion),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(UNLOCK_TTL_MS / 1000),
    }
  );
}

export function clearCatalogueUnlockCookie(res: NextResponse, catalogueId: string) {
  res.cookies.set(cookieName(catalogueId), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** Current lock version (updatedAt) — include in unlock cookies after password set/change. */
export async function getCatalogueLockVersion(catalogueId: string): Promise<string> {
  const env = await prisma.environment.findUnique({
    where: { id: catalogueId },
    select: { settings: true },
  });
  return lockVersionFromSettings(env?.settings);
}

export async function enableCatalogueLock(catalogueId: string, password: string) {
  const invalid = validateCatalogueLockPassword(password);
  if (invalid) throw new Error(invalid);

  const env = await prisma.environment.findUnique({ where: { id: catalogueId } });
  if (!env) throw new Error("Catalogue not found");

  const settings = parseSettings(env.settings);
  const passwordHash = await bcrypt.hash(password, 12);
  settings.lock = {
    enabled: true,
    passwordHash,
    updatedAt: new Date().toISOString(),
  };

  await prisma.environment.update({
    where: { id: catalogueId },
    data: { settings: JSON.stringify(settings) },
  });
}

export async function disableCatalogueLock(catalogueId: string, password: string) {
  const env = await prisma.environment.findUnique({ where: { id: catalogueId } });
  if (!env) throw new Error("Catalogue not found");

  const settings = parseSettings(env.settings);
  const lock = readLock(settings);
  if (!lock.enabled || !lock.passwordHash) {
    throw new Error("This catalogue is not locked.");
  }

  const ok = await bcrypt.compare(String(password ?? ""), lock.passwordHash);
  if (!ok) throw new Error("Incorrect lock password.");

  delete settings.lock;
  await prisma.environment.update({
    where: { id: catalogueId },
    data: { settings: JSON.stringify(settings) },
  });
}

export async function verifyCatalogueLockPassword(catalogueId: string, password: string) {
  const env = await prisma.environment.findUnique({ where: { id: catalogueId } });
  if (!env) throw new Error("Catalogue not found");

  const lock = readLock(parseSettings(env.settings));
  if (!lock.enabled || !lock.passwordHash) {
    return true;
  }
  return bcrypt.compare(String(password ?? ""), lock.passwordHash);
}

/**
 * Locked catalogues require a valid unlock cookie (after password).
 * Unlocked catalogues always pass — no change to existing workflows.
 */
export async function requireCatalogueUnlocked(catalogueId: string): Promise<NextResponse | null> {
  const state = await getCatalogueLockState(catalogueId);
  if (!state.exists) {
    return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
  }
  if (!state.isLocked) return null;
  if (await hasCatalogueUnlockCookie(catalogueId)) return null;
  return NextResponse.json(
    {
      error: "This catalogue is locked. Enter the catalogue password to continue.",
      locked: true,
    },
    { status: 423 }
  );
}
