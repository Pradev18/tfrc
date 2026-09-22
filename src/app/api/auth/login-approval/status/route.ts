import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { safeTokenEqual } from "@/lib/admin-login-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusSchema = z.object({
  requestId: z.string().min(10).max(100),
  pollToken: z.string().min(20).max(256),
});

export async function POST(req: NextRequest) {
  const body = statusSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid approval request" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const approval = await prisma.loginApproval.findUnique({
    where: { id: body.data.requestId },
    select: {
      pollTokenHash: true,
      status: true,
      expiresAt: true,
    },
  });
  if (
    !approval ||
    !safeTokenEqual(body.data.pollToken, approval.pollTokenHash)
  ) {
    return NextResponse.json(
      { error: "Approval request not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (approval.expiresAt <= new Date() && approval.status === "PENDING") {
    await prisma.loginApproval.update({
      where: { id: body.data.requestId },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json(
      { status: "EXPIRED" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { status: approval.status },
    { headers: { "Cache-Control": "no-store" } }
  );
}
