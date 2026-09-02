import "server-only";

import prisma from "@/lib/db";
import {
  DEFAULT_WHATSAPP_SETTINGS,
  type WhatsAppSettings,
} from "@/lib/whatsapp";

export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  try {
    const setting = await prisma.whatsAppSetting.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!setting) return DEFAULT_WHATSAPP_SETTINGS;

    return {
      phoneNumber: setting.phoneNumber.replace(/\D/g, ""),
      defaultGreeting: setting.defaultGreeting,
      productTemplate: setting.productTemplate,
    };
  } catch (error) {
    console.error("[whatsapp] settings prisma failed:", error);
    return DEFAULT_WHATSAPP_SETTINGS;
  }
}
