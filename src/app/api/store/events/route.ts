import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordStoreEvent } from "@/lib/store-event.server";

const eventSchema = z.object({
  eventType: z.string().min(1).max(80),
  environmentSlug: z.string().optional(),
  path: z.string().optional(),
  productId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Lightweight storefront beacon — never blocks UX on failure. */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await recordStoreEvent(parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
