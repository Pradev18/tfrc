import { NextRequest, NextResponse } from "next/server";
import { resolveEnvironment } from "@/services/environment.service";
import {
  applyCatalogueUnlockCookie,
  getCatalogueLockState,
  getCatalogueLockVersion,
  isCatalogueLockedFromSettings,
  verifyCatalogueLockPassword,
} from "@/lib/catalogue-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public catalogue unlock — same password as admin catalogue lock.
 * Sets the shared unlock cookie so storefront + admin APIs both work.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ environment: string }> }
) {
  try {
    const { environment: slug } = await context.params;
    const env = await resolveEnvironment(slug);
    if (!env) {
      return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
    }

    // Static/config-only fallbacks have no real lock storage.
    if (env.id.startsWith("static-")) {
      return NextResponse.json({ unlocked: true, locked: false });
    }

    const state = await getCatalogueLockState(env.id);
    if (!state.exists) {
      return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
    }
    if (!state.isLocked && !isCatalogueLockedFromSettings(env.settings)) {
      return NextResponse.json({ unlocked: true, locked: false });
    }

    const body = (await req.json().catch(() => ({}))) as { password?: string };
    const password = String(body.password ?? "");
    if (!password.trim()) {
      return NextResponse.json({ error: "Enter the catalogue password." }, { status: 400 });
    }

    const ok = await verifyCatalogueLockPassword(env.id, password);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect catalogue password." }, { status: 401 });
    }

    const res = NextResponse.json({ unlocked: true, locked: true });
    applyCatalogueUnlockCookie(res, env.id, await getCatalogueLockVersion(env.id));
    return res;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not unlock catalogue",
      },
      { status: 400 }
    );
  }
}
