import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import { EditCatalogueForm } from "@/components/admin/EditCatalogueForm";
import { CatalogueUnlockGate } from "@/components/admin/CatalogueLockControls";
import { hasCatalogueUnlockCookie } from "@/lib/catalogue-lock";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCataloguePage({ params }: PageProps) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) notFound();

  const isLocked = Boolean(catalogue.isLocked);
  const unlocked = !isLocked || (await hasCatalogueUnlockCookie(id));

  const form = (
    <EditCatalogueForm
      catalogue={{
        id: catalogue.id,
        name: catalogue.name,
        slug: catalogue.slug,
        tagline: catalogue.tagline,
        description: catalogue.description,
        logoUrl: catalogue.logoUrl,
        status: catalogue.status,
        sortOrder: catalogue.sortOrder,
        config: catalogue.config,
      }}
    />
  );

  return (
    <div>
      <Link href={`/admin/catalogues/${id}`} className="text-sm text-text-muted hover:text-primary">
        ← Back to manage
      </Link>
      <h1 className="mt-4 text-display text-3xl text-primary">Edit catalogue card</h1>
      <p className="mt-1 text-text-muted">
        Changes reflect on the TFRC home page and store header for {catalogue.name}.
      </p>
      <div className="mt-8">
        {isLocked && !unlocked ? (
          <CatalogueUnlockGate catalogueId={id} catalogueName={catalogue.name}>
            {form}
          </CatalogueUnlockGate>
        ) : (
          form
        )}
      </div>
    </div>
  );
}
