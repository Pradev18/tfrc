/**
 * Ensures the TFRC administrator exists on Neon (fresh DB bootstrap).
 * Idempotent: never overwrites an existing password unless the one-time
 * passwordMigrationKey has not been applied yet.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();
const passwordMigrationKey = "admin_password_migration_2026_09_v1";
const emailMigrationKey = "admin_email_migration_2026_09_tfrc_v1";
const previousAdministratorEmail = "admin@pawmart.qa";
const administratorEmail = "info@tfrcwholesale.com";
const passwordHash =
  "$2b$12$CkjYPjLSdLgyQVGmHrz08eQFNTrAHVFBc3bTDHyOhCoof/Nfjgtjm";

async function ensureRolesAndAdmin() {
  const superRole = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    create: { name: "SUPER_ADMIN", description: "Full system access" },
    update: {},
  });
  await prisma.role.upsert({
    where: { name: "ADMIN" },
    create: { name: "ADMIN", description: "Administrative access" },
    update: {},
  });

  let admin = await prisma.user.findUnique({
    where: { email: administratorEmail },
    select: { id: true },
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: administratorEmail,
        name: "TFRC Admin",
        passwordHash,
        isActive: true,
        roles: { create: [{ roleId: superRole.id }] },
      },
      select: { id: true },
    });
    console.log(
      `[auth] Created administrator ${administratorEmail} on fresh database.`
    );
  } else {
    const hasRole = await prisma.userRole.findFirst({
      where: { userId: admin.id, roleId: superRole.id },
      select: { id: true },
    });
    if (!hasRole) {
      await prisma.userRole.create({
        data: {
          id: randomBytes(12).toString("hex"),
          userId: admin.id,
          roleId: superRole.id,
        },
      });
      console.log(`[auth] Attached SUPER_ADMIN role to ${administratorEmail}.`);
    }
  }

  return admin;
}

try {
  await ensureRolesAndAdmin();

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
    }
  } else {
    console.log("[auth] Administrator password migration already applied.");
  }
} finally {
  await prisma.$disconnect();
}
