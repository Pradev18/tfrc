import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, lookupGeoFromRequest } from "@/lib/geo";
import { createCustomerInquiry } from "@/services/inquiry.service";

const inquiryItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  slug: z.string().min(1),
  price: z.number(),
  currency: z.string().optional(),
  environmentSlug: z.string().optional(),
  environmentName: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  size: z.string().optional(),
});

const inquirySchema = z.object({
  eventType: z.enum([
    "ADD_TO_CART",
    "REMOVE_FROM_CART",
    "CART_CHECKOUT",
    "PRODUCT_WHATSAPP",
    "CATALOG_PRODUCT",
    "MOBILE_ORDER_BAR",
    "STICKY_BAR",
  ]),
  sessionId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  environmentSlug: z.string().optional(),
  environmentName: z.string().optional(),
  pagePath: z.string().optional(),
  referrer: z.string().optional(),
  itemCount: z.number().optional(),
  estimatedTotal: z.number().optional(),
  currency: z.string().optional(),
  whatsappMessage: z.string().optional(),
  whatsappUrl: z.string().optional(),
  items: z.array(inquiryItemSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const raw =
      req.headers.get("content-type")?.includes("application/json")
        ? await req.json()
        : JSON.parse(await req.text());

    const parsed = inquirySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const [geo] = await Promise.all([lookupGeoFromRequest(req)]);

    await createCustomerInquiry(
      {
        ...parsed.data,
        items: parsed.data.items?.map((item) => ({
          ...item,
          currency: item.currency ?? "QAR",
        })),
      },
      {
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
      geo,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
