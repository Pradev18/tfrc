import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import prisma from "@/lib/db";
import { touchSiteRevision } from "@/lib/site-revision.server";

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const body = (await request.json()) as {
    phoneNumber?: unknown;
    defaultGreeting?: unknown;
    productTemplate?: unknown;
  };
  const phoneNumber = String(body.phoneNumber ?? "").replace(/\D/g, "");
  const defaultGreeting = String(body.defaultGreeting ?? "").trim();
  const productTemplate = String(body.productTemplate ?? "").trim();

  if (phoneNumber.length < 8 || phoneNumber.length > 15) {
    return NextResponse.json(
      { error: "Enter a valid international WhatsApp number" },
      { status: 400 }
    );
  }
  if (!defaultGreeting || defaultGreeting.length > 500) {
    return NextResponse.json(
      { error: "Greeting is required and must be under 500 characters" },
      { status: 400 }
    );
  }
  if (!productTemplate || productTemplate.length > 2000) {
    return NextResponse.json(
      { error: "Product format is required and must be under 2,000 characters" },
      { status: 400 }
    );
  }

  const existing = await prisma.whatsAppSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  const settings = existing
    ? await prisma.whatsAppSetting.update({
        where: { id: existing.id },
        data: { phoneNumber, defaultGreeting, productTemplate, isActive: true },
      })
    : await prisma.whatsAppSetting.create({
        data: { phoneNumber, defaultGreeting, productTemplate, isActive: true },
      });

  await touchSiteRevision();
  revalidatePath("/", "layout");

  return NextResponse.json(
    {
      settings: {
        phoneNumber: settings.phoneNumber,
        defaultGreeting: settings.defaultGreeting,
        productTemplate: settings.productTemplate,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
