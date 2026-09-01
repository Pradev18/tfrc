import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { listCustomerInquiries } from "@/services/inquiry.service";
import { InquiriesClient } from "@/components/admin/InquiriesClient";

export default async function AdminInquiriesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const [{ inquiries, total }, catalogues] = await Promise.all([
    listCustomerInquiries({ pageSize: 50 }),
    prisma.environment.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const eventTypes = [
    "ADD_TO_CART",
    "REMOVE_FROM_CART",
    "CART_CHECKOUT",
    "PRODUCT_WHATSAPP",
    "CATALOG_PRODUCT",
    "MOBILE_ORDER_BAR",
    "STICKY_BAR",
  ];

  const rows = inquiries.map((inquiry) => ({
    id: inquiry.id,
    eventType: inquiry.eventType,
    customerName: inquiry.customerName,
    customerPhone: inquiry.customerPhone,
    city: inquiry.city,
    region: inquiry.region,
    country: inquiry.country,
    environmentName: inquiry.environmentName,
    environmentSlug: inquiry.environmentSlug,
    itemCount: inquiry.itemCount,
    estimatedTotal: inquiry.estimatedTotal,
    currency: inquiry.currency,
    whatsappMessage: inquiry.whatsappMessage,
    pagePath: inquiry.pagePath,
    createdAt: inquiry.createdAt.toISOString(),
    items: inquiry.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      price: item.price,
      currency: item.currency,
    })),
  }));

  return (
    <div>
      <h1 className="text-display text-3xl text-primary">Customer activity</h1>
      <p className="mt-1 text-text-muted">
        Cart additions and WhatsApp order attempts — recorded silently for admin only.
      </p>
      <div className="mt-6">
        <InquiriesClient
          initialRows={rows}
          initialTotal={total}
          eventTypes={eventTypes}
          catalogues={catalogues}
        />
      </div>
    </div>
  );
}
