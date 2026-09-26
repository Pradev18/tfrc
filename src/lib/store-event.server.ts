import { prisma } from "@/lib/db";

/** Fire-and-forget storefront activity row in the `activity` schema. */
export async function recordStoreEvent(input: {
  eventType: string;
  environmentSlug?: string | null;
  path?: string | null;
  productId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.storeEvent.create({
      data: {
        eventType: input.eventType.slice(0, 80),
        environmentSlug: input.environmentSlug?.slice(0, 120) ?? null,
        path: input.path?.slice(0, 500) ?? null,
        productId: input.productId?.slice(0, 120) ?? null,
        sessionId: input.sessionId?.slice(0, 120) ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata).slice(0, 4000) : null,
      },
    });
  } catch (error) {
    console.warn(
      "[activity] StoreEvent write skipped:",
      error instanceof Error ? error.message : error
    );
  }
}
