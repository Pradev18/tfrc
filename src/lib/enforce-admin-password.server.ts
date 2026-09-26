import prisma from "@/lib/db";
import {
  SEALED_ADMIN_EMAIL,
  SEALED_ADMIN_PASSWORD_HASH,
  adminPasswordLocked,
} from "@/lib/admin-password-seal";

/**
 * Restores the sealed admin password if it was changed outside the app.
 * No public API can permanently change the portal password while locked.
 */
export async function enforceSealedAdminPassword(): Promise<void> {
  if (!adminPasswordLocked()) return;

  const admin = await prisma.user.findUnique({
    where: { email: SEALED_ADMIN_EMAIL },
    select: { id: true, passwordHash: true, isActive: true },
  });
  if (!admin) return;

  const needsRestore =
    admin.passwordHash !== SEALED_ADMIN_PASSWORD_HASH || !admin.isActive;
  if (!needsRestore) return;

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      passwordHash: SEALED_ADMIN_PASSWORD_HASH,
      isActive: true,
    },
  });
  console.warn(
    `[auth] Restored sealed administrator password for ${SEALED_ADMIN_EMAIL}`
  );
}
