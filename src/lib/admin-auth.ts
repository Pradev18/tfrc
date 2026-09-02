import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

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
