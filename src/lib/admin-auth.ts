import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import type { Session } from "next-auth";

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);
const DUMMY_PASSWORD_HASH =
  "$2b$12$CkjYPjLSdLgyQVGmHrz08eQFNTrAHVFBc3bTDHyOhCoof/Nfjgtjm";

export async function getVerifiedAdminSession() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      isActive: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (
    !user?.isActive ||
    !user.roles.some((assignment) => ADMIN_ROLES.has(assignment.role.name))
  ) {
    return null;
  }

  return session;
}

export async function requireAdminSession() {
  const session = await getVerifiedAdminSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { session, error: null };
}

/** Re-authenticates a signed-in admin before sensitive security changes. */
export async function verifyCurrentAdminPassword(
  session: Session,
  password: string
): Promise<boolean> {
  const email = session.user?.email?.trim().toLowerCase();
  const user = email
    ? await prisma.user.findUnique({
        where: { email },
        select: { passwordHash: true, isActive: true },
      })
    : null;
  const valid = await bcrypt.compare(
    String(password ?? ""),
    user?.passwordHash ?? DUMMY_PASSWORD_HASH
  );
  return Boolean(user?.isActive && valid);
}
