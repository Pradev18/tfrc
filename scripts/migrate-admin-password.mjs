import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const passwordMigrationKey = "admin_password_migration_2026_09_v1";
const emailMigrationKey = "admin_email_migration_2026_09_tfrc_v1";
const previousAdministratorEmail = "admin@pawmart.qa";
const administratorEmail = "info@tfrcwholesale.com";
const passwordHash =
  "$2b$12$CkjYPjLSdLgyQVGmHrz08eQFNTrAHVFBc3bTDHyOhCoof/Nfjgtjm";

try {
  // 1) Rename admin login email while preserving the current password hash.
  const emailDone = await prisma.siteSetting.findUnique({
    where: { key: emailMigrationKey },
    select: { id: true },
  });

  if (!emailDone) {
    const previous = await prisma.user.findUnique({
      where: { email: previousAdministratorEmail },
      select: { id: true, passwordHash: true, name: true },
    });
    const current = await prisma.user.findUnique({
      where: { email: administratorEmail },
      select: { id: true },
    });

    if (previous && !current) {
      await prisma.user.update({
        where: { id: previous.id },
        data: {
          email: administratorEmail,
          name: previous.name || "TFRC Admin",
        },
      });
      console.log(
        `[auth] Administrator email renamed to ${administratorEmail} (password unchanged).`
      );
    } else if (previous && current && previous.id !== current.id) {
      // Prefer the established password from the previous admin account.
      await prisma.$transaction([
        prisma.user.update({
          where: { id: current.id },
          data: {
            passwordHash: previous.passwordHash,
            isActive: true,
            name: "TFRC Admin",
          },
        }),
        prisma.user.delete({ where: { id: previous.id } }),
      ]);
      console.log(
        `[auth] Merged previous admin into ${administratorEmail} (password preserved).`
      );
    } else if (current) {
      console.log(`[auth] Administrator already uses ${administratorEmail}.`);
    } else {
      console.warn(
        `[auth] No administrator user found to rename to ${administratorEmail}.`
      );
    }

    await prisma.siteSetting.upsert({
      where: { key: emailMigrationKey },
      create: {
        key: emailMigrationKey,
        value: new Date().toISOString(),
        group: "migration",
      },
      update: { value: new Date().toISOString() },
    });
  } else {
    console.log("[auth] Administrator email migration already applied.");
  }

  // 2) One-time password hash migration for the current admin email (idempotent).
  const passwordDone = await prisma.siteSetting.findUnique({
    where: { key: passwordMigrationKey },
    select: { id: true },
  });

  if (!passwordDone) {
    const admin = await prisma.user.findUnique({
      where: { email: administratorEmail },
      select: { id: true },
    });
    if (admin) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: admin.id },
          data: { passwordHash },
        }),
        prisma.siteSetting.create({
          data: {
            key: passwordMigrationKey,
            value: new Date().toISOString(),
            group: "migration",
          },
        }),
      ]);
      console.log("[auth] Applied administrator password migration.");
    } else {
      console.warn(
        `[auth] Skipped password migration — ${administratorEmail} not found.`
      );
    }
  } else {
    console.log("[auth] Administrator password migration already applied.");
  }
} finally {
  await prisma.$disconnect();
}
