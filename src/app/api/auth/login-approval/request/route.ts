import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getRequestSiteUrl } from "@/lib/site-config";
import {
  LOGIN_APPROVAL_TTL_MS,
  adminEmailApprovalRequired,
  hashLoginToken,
  loginRequestIp,
  newLoginToken,
  verifyAdminCredentials,
} from "@/lib/admin-login-approval";
import { sendAdminLoginApprovalEmail } from "@/lib/admin-login-mail.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const ipAddress = loginRequestIp(req.headers);
  const user = await verifyAdminCredentials(
    body.data.email,
    body.data.password,
    ipAddress
  );
  // Critical: no approval row and no email for invalid credentials.
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!adminEmailApprovalRequired()) {
    return NextResponse.json(
      { approvalRequired: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60_000);
  const hourly = await prisma.loginApproval.count({
    where: { userId: user.id, createdAt: { gte: hourAgo } },
  });
  // Abuse cap only — a legitimate new request always supersedes pending ones.
  if (hourly >= 12) {
    return NextResponse.json(
      { error: "Too many login approval requests. Wait before trying again." },
      {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      }
    );
  }

  // Expire every prior pending grant so each new login request is authoritative.
  await prisma.loginApproval.updateMany({
    where: {
      userId: user.id,
      status: "PENDING",
    },
    data: { status: "EXPIRED" },
  });

  const requestToken = newLoginToken();
  const pollToken = newLoginToken();
  const grantToken = newLoginToken();
  const expiresAt = new Date(now.getTime() + LOGIN_APPROVAL_TTL_MS);
  const approval = await prisma.loginApproval.create({
    data: {
      userId: user.id,
      requestTokenHash: hashLoginToken(requestToken),
      pollTokenHash: hashLoginToken(pollToken),
      grantTokenHash: hashLoginToken(grantToken),
      requesterIp: ipAddress,
      userAgent: req.headers.get("user-agent")?.slice(0, 500) || null,
      expiresAt,
    },
  });

  const approvalUrl = new URL(
    "/api/auth/login-approval/approve",
    getRequestSiteUrl(req.headers, req.nextUrl.origin)
  );
  approvalUrl.searchParams.set("token", requestToken);

  try {
    const mailed = await sendAdminLoginApprovalEmail({
      approvalUrl: approvalUrl.toString(),
      loginEmail: user.email,
      ipAddress,
      userAgent: req.headers.get("user-agent") || "Unknown browser",
      expiresMinutes: Math.floor(LOGIN_APPROVAL_TTL_MS / 60_000),
    });
    return NextResponse.json(
      {
        requestId: approval.id,
        pollToken,
        grantToken,
        approvalRequired: true,
        expiresAt: expiresAt.toISOString(),
        recipients: mailed.recipients,
        message:
          "Credentials verified. Approval email sent — check Inbox and Spam/Junk.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    await prisma.loginApproval.delete({ where: { id: approval.id } }).catch(() => null);
    console.error("[login-approval] SMTP send failed", error);
    return NextResponse.json(
      {
        error:
          "Could not send the approval email. Check Hostinger SMTP_USER / SMTP_PASSWORD, or use the LOGIN_APPROVAL_SECRET inbox backup after deploy.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
