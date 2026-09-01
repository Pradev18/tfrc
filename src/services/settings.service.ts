import prisma from "@/lib/db";

export async function getSiteSettings() {
  const settings = await prisma.siteSetting.findMany();
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const s = await prisma.siteSetting.findUnique({ where: { key } });
  return s?.value ?? fallback;
}

export async function getHomepageSections() {
  return prisma.homepageSection.findMany({
    where: { isEnabled: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getActiveBanners() {
  const now = new Date();
  return prisma.banner.findMany({
    where: {
      isActive: true,
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: { gte: now } },
      ],
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getSocialLinks() {
  return prisma.socialLink.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getDeliverySettings() {
  return prisma.deliverySetting.findFirst();
}

export async function getWhatsAppSettingsAdmin() {
  return prisma.whatsAppSetting.findFirst({ where: { isActive: true } });
}
