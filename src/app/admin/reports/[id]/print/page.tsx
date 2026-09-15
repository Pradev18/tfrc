import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOfficeReportPrintMeta } from "@/services/office-report.service";
import { ReportPrintClient } from "@/components/admin/ReportPrintClient";

export default async function AdminReportPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const meta = await getOfficeReportPrintMeta(id);
  if (!meta) notFound();

  return <ReportPrintClient reportId={id} initialMeta={meta} />;
}
