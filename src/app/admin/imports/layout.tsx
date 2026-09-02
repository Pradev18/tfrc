import { redirect } from "next/navigation";
import { getVerifiedAdminSession } from "@/lib/admin-auth";

export default async function AdminImportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getVerifiedAdminSession();
  if (!session) {
    redirect("/admin/login?callbackUrl=%2Fadmin%2Fimports");
  }

  return children;
}
