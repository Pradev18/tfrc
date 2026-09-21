import "server-only";

import prisma from "@/lib/db";
import { cache } from "react";
import {
  DEFAULT_WHATSAPP_SETTINGS,
  type WhatsAppSettings,
} from "@/lib/whatsapp";

const MEMORY_TTL_MS = 5 * 60_000;
let memoryHit: { value: WhatsAppSettings; storedAt: number } | null = null;

export const getWhatsAppSettings = cache(async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  if (memoryHit && Date.now() - memoryHit.storedAt < MEMORY_TTL_MS) {
    return memoryHit.value;
  }

  try {
    const setting = await prisma.whatsAppSetting.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    const value = !setting
      ? DEFAULT_WHATSAPP_SETTINGS
      : {
          phoneNumber: setting.phoneNumber.replace(/\D/g, ""),
          defaultGreeting: setting.defaultGreeting,
          orderIntro: setting.orderIntro,
          productTemplate: setting.productTemplate,
          closingMessage: setting.closingMessage,
        };

    memoryHit = { value, storedAt: Date.now() };
    return value;
  } catch (error) {
    console.error("[whatsapp] settings prisma failed:", error);
    return memoryHit?.value ?? DEFAULT_WHATSAPP_SETTINGS;
  }
});
