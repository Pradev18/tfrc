import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  createCatalogue,
  listCatalogues,
  generateShopCategories,
} from "@/services/catalogue-admin.service";

export async function GET() {
  const { error } = await requireAdminSession();
  if (error) return error;
  const catalogues = await listCatalogues(true);
  return NextResponse.json({ catalogues });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  try {
    const body = await req.json();
    const env = await createCatalogue(
      {
        name: body.name,
        slug: body.slug,
        tagline: body.tagline,
        description: body.description,
        logoUrl: body.logoUrl,
        icon: body.icon,
        departmentSource: body.departmentSource,
        heroHeadline: body.heroHeadline,
        status: body.status,
      },
      session!.user?.id
    );

    if (body.autoCategories !== false) {
      await generateShopCategories(env.id, env.slug);
    }

    return NextResponse.json({ catalogue: env }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create catalogue" },
      { status: 400 }
    );
  }
}
