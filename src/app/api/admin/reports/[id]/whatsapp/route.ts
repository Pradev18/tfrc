import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { saveOwnerReportPdf } from "@/lib/report/owner-report-pdf-store";
import {
  buildOwnerReportCaption,
  ownerWhatsAppChatUrl,
  sendPdfToOwnerWhatsApp,
} from "@/lib/report/owner-whatsapp";
import { getOfficeReportPrintMeta } from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

function pdfFilename(title: string): string {
  const safe = title.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${safe || "TFRC-report"}.pdf`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const meta = await getOfficeReportPrintMeta(id);
  if (!meta) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (meta.lineCount < 1) {
    return NextResponse.json({ error: "Add items before sending the PDF" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing PDF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "PDF is too large to send" }, { status: 413 });
  }

  const pdf = Buffer.from(await file.arrayBuffer());
  const token = await saveOwnerReportPdf(pdf);
  const pdfUrl = new URL(`/api/reports/owner-copy/${token}`, req.nextUrl.origin).toString();
  const filename = pdfFilename(meta.title);
  const caption = buildOwnerReportCaption({
    title: meta.title,
    customerName: meta.customerName,
    reportDate: meta.reportDate,
    lineCount: meta.lineCount,
  });
  const message = `${caption}\n\nPDF copy:\n${pdfUrl}`;

  const delivery = await sendPdfToOwnerWhatsApp({ pdf, filename, caption });

  return NextResponse.json({
    sent: delivery.sent,
    pdfUrl,
    whatsappHref: ownerWhatsAppChatUrl(message),
    destination: "+97455049229",
    note: delivery.sent
      ? "PDF copy sent to +974 5504 9229 only."
      : "WhatsApp chat is locked to +974 5504 9229. Send the message to deliver the PDF copy.",
  });
}
