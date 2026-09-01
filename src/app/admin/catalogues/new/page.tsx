import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreateCatalogueWizard } from "@/components/admin/CreateCatalogueWizard";

export default async function CreateCataloguePage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  return (
    <div>
      <h1 className="text-display text-3xl text-primary">Create catalogue</h1>
      <p className="mt-1 text-text-muted">
        Set up name, image & description — then upload products via Excel.
      </p>
      <div className="mt-8">
        <CreateCatalogueWizard />
      </div>
    </div>
  );
}
