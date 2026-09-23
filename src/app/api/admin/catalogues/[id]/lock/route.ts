import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminSession,
  verifyCurrentAdminPassword,
} from "@/lib/admin-auth";
import {
  applyCatalogueUnlockCookie,
  clearCatalogueUnlockCookie,
  disableCatalogueLock,
  enableCatalogueLock,
  getCatalogueLockState,
  hasCatalogueUnlockCookie,
  requireCatalogueUnlocked,
  verifyCatalogueLockPassword,
} from "@/lib/catalogue-lock";
import { persistRuntimeCatalogueDataSafely } from "@/lib/persist-runtime-data.server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const state = await getCatalogueLockState(id);
  if (!state.exists) {
    return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
  }
  const unlocked = state.isLocked ? await hasCatalogueUnlockCookie(id) : true;
  return NextResponse.json({
    isLocked: state.isLocked,
    unlocked,
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as
    | {
        action?: string;
        password?: string;
        confirmPassword?: string;
        adminPassword?: string;
      }
    | null;

  const action = String(body?.action || "");
  const password = String(body?.password ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");

  try {
    if (action === "lock-session") {
      // Force password prompt again on the next catalogue open.
      const res = NextResponse.json({ ok: true, unlocked: false });
      clearCatalogueUnlockCookie(res, id);
      return res;
    }

    if (action === "unlock") {
      const state = await getCatalogueLockState(id);
      if (!state.exists) {
        return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
      }
      if (!state.isLocked) {
        return NextResponse.json({ ok: true, isLocked: false, unlocked: true });
      }
      const ok = await verifyCatalogueLockPassword(id, password);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect lock password." }, { status: 401 });
      }
      const res = NextResponse.json({ ok: true, isLocked: true, unlocked: true });
      applyCatalogueUnlockCookie(res, id);
      return res;
    }

    if (action === "enable") {
      // Enabling requires current unlock if already locked (changing password).
      const gated = await requireCatalogueUnlocked(id);
      if (gated) return gated;
      if (password !== confirmPassword) {
        return NextResponse.json(
          { error: "Password and confirm password do not match." },
          { status: 400 }
        );
      }
      await enableCatalogueLock(id, password);
      void persistRuntimeCatalogueDataSafely();
      const res = NextResponse.json({ ok: true, isLocked: true, unlocked: true });
      applyCatalogueUnlockCookie(res, id);
      return res;
    }

    if (action === "change-password") {
      // Allowed from the locked gate: admin portal password is the gate, not the catalogue unlock cookie.
      if (!session || !(await verifyCurrentAdminPassword(session, body?.adminPassword ?? ""))) {
        return NextResponse.json(
          { error: "The admin portal password is incorrect." },
          { status: 401 }
        );
      }
      if (password !== confirmPassword) {
        return NextResponse.json(
          { error: "New password and confirm password do not match." },
          { status: 400 }
        );
      }
      const state = await getCatalogueLockState(id);
      if (!state.exists) {
        return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
      }
      if (!state.isLocked) {
        return NextResponse.json(
          { error: "Lock this catalogue before changing its password." },
          { status: 400 }
        );
      }
      const alreadyUnlocked = await hasCatalogueUnlockCookie(id);
      await enableCatalogueLock(id, password);
      void persistRuntimeCatalogueDataSafely();
      const res = NextResponse.json({
        ok: true,
        isLocked: true,
        unlocked: alreadyUnlocked,
      });
      if (alreadyUnlocked) {
        applyCatalogueUnlockCookie(res, id);
      } else {
        clearCatalogueUnlockCookie(res, id);
      }
      return res;
    }

    if (action === "disable") {
      await disableCatalogueLock(id, password);
      void persistRuntimeCatalogueDataSafely();
      const res = NextResponse.json({ ok: true, isLocked: false, unlocked: true });
      clearCatalogueUnlockCookie(res, id);
      return res;
    }

    return NextResponse.json(
      { error: "Unknown lock action. Use unlock, enable, change-password, or disable." },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lock action failed" },
      { status: 400 }
    );
  }
}
