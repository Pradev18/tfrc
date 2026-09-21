import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import { ManageCataloguePanel } from "@/components/admin/ManageCataloguePanel";
import { DeleteCatalogueSection } from "@/components/admin/DeleteCatalogueSection";
import {
  CatalogueLockControls,
  CatalogueUnlockGate,
} from "@/components/admin/CatalogueLockControls";
import { hasCatalogueUnlockCookie } from "@/lib/catalogue-lock";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ManageCataloguePage({ params }: PageProps) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) notFound();

  const isLocked = Boolean(catalogue.isLocked);
  const unlocked = !isLocked || (await hasCatalogueUnlockCookie(id));

  const manageBody = (
    <>
      <div className="mt-6">
        <CatalogueLockControls
          catalogueId={id}
          isLocked={isLocked}
          unlocked={unlocked}
        />
      </div>

      <div className="mt-8">
        <ManageCataloguePanel
          catalogueId={id}
          catalogueName={catalogue.name}
          catalogueSlug={catalogue.slug}
        />
      </div>

      <DeleteCatalogueSection
        catalogueId={id}
        catalogueName={catalogue.name}
        productCount={catalogue._count.products}
      />
    </>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-text-muted">Manage catalogue</p>
          <h1 className="text-display text-3xl text-primary">
            {catalogue.name}
            {isLocked ? (
              <span className="ml-2 align-middle text-sm font-semibold text-amber-700">
                · Locked
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            <a href={`/${catalogue.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
              View live store →
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/catalogues/${id}/edit`}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            Edit card
          </Link>
        </div>
      </div>

      {isLocked && !unlocked ? (
        <CatalogueUnlockGate catalogueId={id} catalogueName={catalogue.name}>
          {manageBody}
        </CatalogueUnlockGate>
      ) : (
        manageBody
      )}
    </div>
  );
}
