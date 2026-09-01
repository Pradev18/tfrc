import prisma from "@/lib/db";
import type { GeoLocation } from "@/lib/geo";
import type { InquiryListFilters, TrackInquiryPayload } from "@/lib/inquiry-types";

export async function createCustomerInquiry(
  payload: TrackInquiryPayload,
  context: {
    ipAddress?: string | null;
    userAgent?: string | null;
    geo?: GeoLocation;
  }
) {
  const items = payload.items ?? [];
  const itemCount = payload.itemCount ?? items.length;

  return prisma.customerInquiry.create({
    data: {
      eventType: payload.eventType,
      sessionId: payload.sessionId,
      customerName: payload.customerName?.trim() || null,
      customerPhone: payload.customerPhone?.replace(/\D/g, "") || null,
      environmentSlug: payload.environmentSlug ?? null,
      environmentName: payload.environmentName ?? null,
      pagePath: payload.pagePath ?? null,
      referrer: payload.referrer ?? null,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      city: context.geo?.city ?? null,
      region: context.geo?.region ?? null,
      country: context.geo?.country ?? null,
      timezone: context.geo?.timezone ?? null,
      itemCount,
      estimatedTotal: payload.estimatedTotal ?? null,
      currency: payload.currency ?? "QAR",
      whatsappMessage: payload.whatsappMessage ?? null,
      whatsappUrl: payload.whatsappUrl ?? null,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          slug: item.slug,
          price: item.price,
          currency: item.currency ?? "QAR",
          environmentSlug: item.environmentSlug ?? null,
          environmentName: item.environmentName ?? null,
        })),
      },
    },
    include: { items: true },
  });
}

export async function listCustomerInquiries(filters: InquiryListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.environmentSlug) where.environmentSlug = filters.environmentSlug;

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { customerName: { contains: q } },
      { customerPhone: { contains: q } },
      { whatsappMessage: { contains: q } },
      { city: { contains: q } },
      { country: { contains: q } },
      { sessionId: { contains: q } },
    ];
  }

  const [inquiries, total] = await Promise.all([
    prisma.customerInquiry.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.customerInquiry.count({ where }),
  ]);

  return { inquiries, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getInquiriesForExport(filters: InquiryListFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.environmentSlug) where.environmentSlug = filters.environmentSlug;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { customerName: { contains: q } },
      { customerPhone: { contains: q } },
      { whatsappMessage: { contains: q } },
      { city: { contains: q } },
      { country: { contains: q } },
    ];
  }

  return prisma.customerInquiry.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });
}
