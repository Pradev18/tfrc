import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const migrationKey = "admin_password_migration_2026_09_v1";
const administratorEmail = "admin@pawmart.qa";
const passwordHash =
  "$2b$12$CkjYPjLSdLgyQVGmHrz08eQFNTrAHVFBc3bTDHyOhCoof/Nfjgtjm";

try {
  const completed = await prisma.siteSetting.findUnique({
    where: { key: migrationKey },
    select: { id: true },
  });

  if (!completed) {
    await prisma.$transaction([
      prisma.user.update({
        where: { email: administratorEmail },
        data: { passwordHash },
      }),
      prisma.siteSetting.create({
        data: {
          key: migrationKey,
          value: new Date().toISOString(),
          group: "migration",
        },
      }),
    ]);
    console.log("[auth] Applied administrator password migration.");
  } else {
    console.log("[auth] Administrator password migration already applied.");
  }
} finally {
  await prisma.$disconnect();
}
