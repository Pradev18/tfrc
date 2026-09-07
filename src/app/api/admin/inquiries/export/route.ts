import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdminSession } from "@/lib/admin-auth";
import { getInquiriesForExport } from "@/services/inquiry.service";
import { formatInquiryEventLabel } from "@/lib/inquiry-types";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const inquiries = await getInquiriesForExport({
    eventType: searchParams.get("eventType") ?? undefined,
    environmentSlug: searchParams.get("environmentSlug") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    from: parseDate(searchParams.get("from")),
    to: parseDate(searchParams.get("to")),
  });

  const rows = inquiries.flatMap((inquiry) => {
    const base = {
      Date: inquiry.createdAt.toISOString(),
      Event: formatInquiryEventLabel(inquiry.eventType),
      Name: inquiry.customerName ?? "",
      Phone: inquiry.customerPhone ?? "",
      City: inquiry.city ?? "",
      Region: inquiry.region ?? "",
      Country: inquiry.country ?? "",
      Timezone: inquiry.timezone ?? "",
      Catalogue: inquiry.environmentName ?? inquiry.environmentSlug ?? "",
      "Item count": inquiry.itemCount,
      "Estimated total": inquiry.estimatedTotal ?? "",
      Currency: inquiry.currency,
      "WhatsApp message": inquiry.whatsappMessage ?? "",
      "WhatsApp URL": inquiry.whatsappUrl ?? "",
      Page: inquiry.pagePath ?? "",
      Referrer: inquiry.referrer ?? "",
      "IP address": inquiry.ipAddress ?? "",
      "Session ID": inquiry.sessionId ?? "",
    };

    if (inquiry.items.length === 0) {
      return [base];
    }

    return inquiry.items.map((item, index) => ({
      ...base,
      "Product #": index + 1,
      "Product ID": item.productId,
      "Product name": item.productName,
      "Product slug": item.slug,
      "Product price": item.price,
      "Product size": item.size ?? "",
      "Product quantity": item.quantity,
      "Product currency": item.currency,
      "Product catalogue": item.environmentName ?? item.environmentSlug ?? "",
    }));
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Customer inquiries");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="customer-inquiries-${date}.xlsx"`,
    },
  });
}
