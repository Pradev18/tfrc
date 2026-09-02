import "server-only";

import { randomUUID } from "crypto";
import prisma from "@/lib/db";

const SITE_REVISION_KEY = "public_site_revision";

export async function touchSiteRevision(): Promise<string> {
  const revision = `${Date.now()}-${randomUUID()}`;
  await prisma.siteSetting.upsert({
    where: { key: SITE_REVISION_KEY },
    create: {
      key: SITE_REVISION_KEY,
      value: revision,
      group: "system",
    },
    update: { value: revision },
  });
  return revision;
}

export async function getSiteRevision(): Promise<string> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: SITE_REVISION_KEY },
    select: { value: true },
  });
  return setting?.value ?? "0";
}
