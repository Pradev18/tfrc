import "server-only";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for admin login approval email.`);
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Comma/semicolon-separated recipients (Hostinger inbox + personal backup). */
export function loginApprovalRecipients(): string[] {
  const raw =
    process.env.LOGIN_APPROVAL_RECIPIENT?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "info@tfrcwholesale.com";
  const list = raw
    .split(/[,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
}

type SmtpAttempt = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
};

function smtpAttempts(): SmtpAttempt[] {
  const configuredHost = process.env.SMTP_HOST?.trim() || "smtp.hostinger.com";
  const configuredPort = Number(process.env.SMTP_PORT || 465);
  const primary: SmtpAttempt = {
    host: configuredHost,
    port: configuredPort,
    secure: configuredPort === 465,
    requireTLS: configuredPort === 587,
  };
  const fallbacks: SmtpAttempt[] = [
    { host: "smtp.hostinger.com", port: 587, secure: false, requireTLS: true },
    { host: "smtp.hostinger.com", port: 465, secure: true },
  ];
  const seen = new Set<string>();
  const ordered: SmtpAttempt[] = [];
  for (const attempt of [primary, ...fallbacks]) {
    const key = `${attempt.host}:${attempt.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(attempt);
  }
  return ordered;
}

async function sendWithTransport(
  attempt: SmtpAttempt,
  user: string,
  pass: string,
  mail: nodemailer.SendMailOptions
): Promise<SMTPTransport.SentMessageInfo> {
  const transporter = nodemailer.createTransport({
    host: attempt.host,
    port: attempt.port,
    secure: attempt.secure,
    requireTLS: attempt.requireTLS,
    auth: { user, pass },
    tls: {
      minVersion: "TLSv1.2",
      // Hostinger shared SMTP intermittently presents mismatched certs on 587.
      rejectUnauthorized: attempt.port === 465,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
  });

  await transporter.verify();
  const info = await transporter.sendMail(mail);
  const rejected = info.rejected ?? [];
  if (rejected.length > 0) {
    throw new Error(`SMTP rejected recipients: ${rejected.join(", ")}`);
  }
  if (!info.accepted || info.accepted.length === 0) {
    throw new Error("SMTP accepted no recipients.");
  }
  return info;
}

export async function sendAdminLoginApprovalEmail(input: {
  approvalUrl: string;
  loginEmail: string;
  ipAddress: string;
  userAgent: string;
  expiresMinutes: number;
}): Promise<{ recipients: string[]; messageId?: string; via: string }> {
  const user = required("SMTP_USER");
  const pass = required("SMTP_PASSWORD");
  const recipients = loginApprovalRecipients();
  if (recipients.length === 0) {
    throw new Error("LOGIN_APPROVAL_RECIPIENT is empty.");
  }

  // Always use the authenticated mailbox as the From address. Display-name-only
  // strings and mismatched From headers are a common Hostinger drop cause.
  const fromAddress = user;
  const fromName = "TFRC Wholesale Services";

  const email = escapeHtml(input.loginEmail);
  const ip = escapeHtml(input.ipAddress);
  const agent = escapeHtml(input.userAgent || "Unknown browser");
  const approvalUrlHtml = escapeHtml(input.approvalUrl);

  const mail: nodemailer.SendMailOptions = {
    from: { name: fromName, address: fromAddress },
    to: recipients,
    replyTo: fromAddress,
    subject: "TFRC Admin login approval required",
    headers: {
      "X-TFRC-Purpose": "admin-login-approval",
      Importance: "high",
    },
    text:
      `A user entered the correct TFRC admin credentials.\n\n` +
      `Account: ${input.loginEmail}\nIP: ${input.ipAddress}\n` +
      `Browser: ${input.userAgent}\n\n` +
      `Review and authenticate this request within ${input.expiresMinutes} minutes:\n` +
      `${input.approvalUrl}\n\n` +
      `If you do not see this in Inbox, check Spam/Junk in Hostinger webmail.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#19151b">
        <div style="border:1px solid #eadff0;border-radius:16px;padding:28px">
          <div style="display:flex;gap:7px;margin-bottom:20px">
            <span style="display:block;width:12px;height:38px;background:#7B2D8E;border-radius:2px"></span>
            <span style="display:block;width:12px;height:38px;background:#7B2D8E;border-radius:2px"></span>
            <span style="display:block;width:12px;height:38px;background:#7B2D8E;border-radius:2px"></span>
          </div>
          <h1 style="font-size:22px;margin:0 0 10px">Admin login approval</h1>
          <p style="line-height:1.6;color:#5e5661">
            Someone entered the correct username and password for the TFRC admin portal.
            The login remains blocked until you approve it.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
            <tr><td style="padding:8px 0;color:#756d78">Account</td><td>${email}</td></tr>
            <tr><td style="padding:8px 0;color:#756d78">IP address</td><td>${ip}</td></tr>
            <tr><td style="padding:8px 0;color:#756d78">Browser</td><td>${agent}</td></tr>
          </table>
          <a href="${approvalUrlHtml}"
             style="display:inline-block;background:#7B2D8E;color:#fff;text-decoration:none;
                    font-weight:700;padding:13px 22px;border-radius:9px">
            Review &amp; Authenticate
          </a>
          <p style="font-size:12px;color:#817985;margin-top:20px;line-height:1.5">
            Expires in ${input.expiresMinutes} minutes. Check Spam/Junk if this is missing from Inbox.
            Opening the link does not approve automatically; a final confirmation click is required.
          </p>
        </div>
      </div>
    `,
  };

  const errors: string[] = [];
  for (const attempt of smtpAttempts()) {
    try {
      const info = await sendWithTransport(attempt, user, pass, mail);
      console.info("[login-approval] SMTP accepted", {
        via: `${attempt.host}:${attempt.port}`,
        messageId: info.messageId,
        accepted: info.accepted,
        recipients,
      });
      return {
        recipients,
        messageId: info.messageId,
        via: `${attempt.host}:${attempt.port}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${attempt.host}:${attempt.port} → ${message}`);
      console.error("[login-approval] SMTP attempt failed", attempt, message);
    }
  }

  throw new Error(`All SMTP attempts failed. ${errors.join(" | ")}`);
}
