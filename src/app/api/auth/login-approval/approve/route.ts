import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashLoginToken } from "@/lib/admin-login-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, message: string, token?: string): NextResponse {
  const safeTitle = title.replace(/[<>&"]/g, "");
  const safeMessage = message.replace(/[<>&"]/g, "");
  const safeToken = token?.replace(/[^A-Za-z0-9_-]/g, "") || "";
  const form = safeToken
    ? `
      <form method="post" action="/api/auth/login-approval/approve">
        <input type="hidden" name="token" value="${safeToken}" />
        <button type="submit">Authenticate Login</button>
      </form>`
    : "";
  return new NextResponse(
    `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>${safeTitle}</title>
        <style>
          body{margin:0;background:#f8f5f9;color:#19151b;font-family:Arial,sans-serif}
          main{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
          section{width:100%;max-width:520px;background:#fff;border:1px solid #eadff0;
            border-radius:18px;padding:32px;box-shadow:0 14px 40px rgba(47,25,52,.08)}
          .mark{display:flex;gap:7px;margin-bottom:22px}.mark i{width:13px;height:40px;
            border-radius:2px;background:#7B2D8E}
          h1{font-size:25px;margin:0 0 12px}p{color:#625966;line-height:1.65}
          button{width:100%;border:0;border-radius:10px;background:#7B2D8E;color:#fff;
            padding:14px 18px;font-size:16px;font-weight:700;cursor:pointer;margin-top:14px}
          small{display:block;color:#817985;margin-top:18px;line-height:1.5}
        </style>
      </head>
      <body><main><section>
        <div class="mark"><i></i><i></i><i></i></div>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
        ${form}
        <small>Only approve if you recognize the login request. The approval is one-time and expires shortly.</small>
      </section></main></body>
    </html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        "X-Frame-Options": "DENY",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!token || token.length > 256) {
    return page("Invalid request", "This login approval link is invalid.");
  }

  const approval = await prisma.loginApproval.findUnique({
    where: { requestTokenHash: hashLoginToken(token) },
    select: { status: true, expiresAt: true },
  });
  if (!approval || approval.status !== "PENDING" || approval.expiresAt <= new Date()) {
    return page(
      "Approval unavailable",
      "This login request has expired, was already used, or is no longer pending."
    );
  }
  return page(
    "Authenticate TFRC admin login",
    "The username and password were correct. Click below to permit this one login.",
    token
  );
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get("token") || "");
  if (!token || token.length > 256) {
    return page("Invalid request", "This login approval link is invalid.");
  }

  const now = new Date();
  const approved = await prisma.loginApproval.updateMany({
    where: {
      requestTokenHash: hashLoginToken(token),
      status: "PENDING",
      expiresAt: { gt: now },
    },
    data: {
      status: "APPROVED",
      approvedAt: now,
    },
  });
  if (approved.count !== 1) {
    return page(
      "Approval unavailable",
      "This login request has expired, was already approved, or is no longer pending."
    );
  }
  return page(
    "Login authenticated",
    "Access has been approved. You can close this page; the requesting browser will sign in automatically."
  );
}
