import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listOfficeReports } from "@/services/office-report.service";
import { ReportsAdminClient } from "@/components/admin/ReportsAdminClient";

export default async function AdminReportsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const reports = await listOfficeReports();
  return <ReportsAdminClient initialReports={reports} />;
}
