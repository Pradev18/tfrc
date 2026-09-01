import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import prisma from "@/lib/db";
import { ProductStatus } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const body = await req.json();

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.status !== undefined ? { status: body.status as ProductStatus } : {}),
      ...(body.shortDescription !== undefined ? { shortDescription: body.shortDescription } : {}),
      ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
    },
  });

  if (body.regularPrice !== undefined) {
    const regular = await prisma.price.findFirst({
      where: { productId: id, type: "REGULAR" },
    });
    if (regular) {
      await prisma.price.update({ where: { id: regular.id }, data: { amount: Number(body.regularPrice) } });
    } else {
      await prisma.price.create({
        data: { productId: id, amount: Number(body.regularPrice), type: "REGULAR", currency: "QAR" },
      });
    }
  }

  if (body.salePrice !== undefined) {
    const sale = await prisma.price.findFirst({
      where: { productId: id, type: "SALE" },
    });
    if (body.salePrice === null || body.salePrice === "") {
      if (sale) await prisma.price.delete({ where: { id: sale.id } });
    } else if (sale) {
      await prisma.price.update({ where: { id: sale.id }, data: { amount: Number(body.salePrice) } });
    } else {
      await prisma.price.create({
        data: { productId: id, amount: Number(body.salePrice), type: "SALE", currency: "QAR" },
      });
    }
  }

  if (body.quantity !== undefined) {
    await prisma.inventory.upsert({
      where: { productId: id },
      create: {
        productId: id,
        quantity: Number(body.quantity),
        isInStock: Number(body.quantity) > 0,
      },
      update: {
        quantity: Number(body.quantity),
        isInStock: Number(body.quantity) > 0,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session!.user?.id,
      action: "UPDATE",
      resource: "Product",
      resourceId: id,
      newValue: JSON.stringify(body),
    },
  });

  return NextResponse.json({ product: updated });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;

  await prisma.product.update({
    where: { id },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session!.user?.id,
      action: "ARCHIVE",
      resource: "Product",
      resourceId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
