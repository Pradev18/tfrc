import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOfficeReportDetail } from "@/services/office-report.service";
import { ReportEditorClient } from "@/components/admin/ReportEditorClient";

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const report = await getOfficeReportDetail(id);
  if (!report) notFound();

  return <ReportEditorClient initialReport={report} />;
}
