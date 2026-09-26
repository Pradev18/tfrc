import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import prisma from "@/lib/db";
import { LOGIN_APPROVAL_TTL_MS } from "@/lib/admin-login-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(html: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <meta name="robots" content="noindex,nofollow"/>
      <title>TFRC login approvals</title>
      <style>
        body{margin:0;background:#f8f5f9;color:#19151b;font-family:Arial,sans-serif}
        main{min-height:100vh;display:flex;justify-content:center;padding:28px 16px}
        section{width:100%;max-width:640px;background:#fff;border:1px solid #eadff0;
          border-radius:18px;padding:28px;box-shadow:0 14px 40px rgba(47,25,52,.08)}
        h1{font-size:24px;margin:0 0 8px}p{color:#625966;line-height:1.55}
        .card{border:1px solid #eadff0;border-radius:12px;padding:14px 16px;margin-top:14px}
        .meta{font-size:13px;color:#756d78;line-height:1.5}
        button{margin-top:10px;border:0;border-radius:10px;background:#7B2D8E;color:#fff;
          padding:11px 16px;font-size:14px;font-weight:700;cursor:pointer}
        .empty{margin-top:18px;color:#817985}
      </style>
    </head><body><main><section>${html}</section></main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    }
  );
}

function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readSecret(req: NextRequest): string {
  return (
    req.nextUrl.searchParams.get("key")?.trim() ||
    req.headers.get("x-tfrc-approval-key")?.trim() ||
    ""
  );
}

function authorized(req: NextRequest): boolean {
  const expected = process.env.LOGIN_APPROVAL_SECRET?.trim() || "";
  if (!expected || expected.length < 16) return false;
  return safeEqual(readSecret(req), expected);
}

/**
 * Backup when Hostinger email does not arrive.
 * Bookmark: /api/auth/login-approval/inbox?key=YOUR_LOGIN_APPROVAL_SECRET
 * Only people with the Hostinger env secret can see/approve pending logins.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return page(
      `<h1>Unauthorized</h1><p>Set LOGIN_APPROVAL_SECRET in Hostinger and open this page with that key.</p>`,
      401
    );
  }

  const now = new Date();
  await prisma.loginApproval.updateMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });

  const pending = await prisma.loginApproval.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { email: true } } },
  });

  const key = encodeURIComponent(readSecret(req));
  const cards =
    pending.length === 0
      ? `<p class="empty">No pending login requests.</p>`
      : pending
          .map((item) => {
            const ageMin = Math.max(
              0,
              Math.round((now.getTime() - item.createdAt.getTime()) / 60_000)
            );
            const leftMin = Math.max(
              1,
              Math.round((item.expiresAt.getTime() - now.getTime()) / 60_000)
            );
            const safeEmail = item.user.email.replace(/[<>&"]/g, "");
            const safeIp = (item.requesterIp || "unknown").replace(/[<>&"]/g, "");
            const safeUa = (item.userAgent || "unknown")
              .slice(0, 160)
              .replace(/[<>&"]/g, "");
            return `<div class="card">
              <strong>${safeEmail}</strong>
              <div class="meta">IP: ${safeIp}<br/>
              Browser: ${safeUa}<br/>
              Requested ${ageMin}m ago · expires in ${leftMin}m</div>
              <form method="post" action="/api/auth/login-approval/inbox?key=${key}">
                <input type="hidden" name="id" value="${item.id.replace(/[^a-zA-Z0-9_-]/g, "")}" />
                <button type="submit">Approve this login</button>
              </form>
            </div>`;
          })
          .join("");

  return page(
    `<h1>Pending admin logins</h1>
     <p>Use this page when the Hostinger approval email does not arrive. Approvals expire after ${Math.floor(LOGIN_APPROVAL_TTL_MS / 60_000)} minutes.</p>
     ${cards}`
  );
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return page(`<h1>Unauthorized</h1><p>Invalid approval secret.</p>`, 401);
  }

  const form = await req.formData();
  const id = String(form.get("id") || "");
  if (!id) {
    return page(`<h1>Invalid request</h1><p>Missing approval id.</p>`, 400);
  }

  const now = new Date();
  const updated = await prisma.loginApproval.updateMany({
    where: {
      id,
      status: "PENDING",
      expiresAt: { gt: now },
    },
    data: {
      status: "APPROVED",
      approvedAt: now,
    },
  });

  if (updated.count !== 1) {
    return page(
      `<h1>Already handled</h1><p>This login request expired or was already approved.</p>
       <p><a href="/api/auth/login-approval/inbox?key=${encodeURIComponent(readSecret(req))}">Back to pending list</a></p>`
    );
  }

  return page(
    `<h1>Login approved</h1>
     <p>The waiting browser will sign in automatically within a few seconds. You can close this tab.</p>
     <p><a href="/api/auth/login-approval/inbox?key=${encodeURIComponent(readSecret(req))}">Back to pending list</a></p>`
  );
}
