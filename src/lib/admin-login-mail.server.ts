import "server-only";
import nodemailer from "nodemailer";

const APPROVAL_RECIPIENT =
  process.env.LOGIN_APPROVAL_RECIPIENT || "info@tfrcwholesale.com";

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

export async function sendAdminLoginApprovalEmail(input: {
  approvalUrl: string;
  loginEmail: string;
  ipAddress: string;
  userAgent: string;
  expiresMinutes: number;
}): Promise<void> {
  const host = process.env.SMTP_HOST?.trim() || "smtp.hostinger.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = required("SMTP_USER");
  const pass = required("SMTP_PASSWORD");
  const secure = port === 465;
  const from =
    process.env.SMTP_FROM?.trim() ||
    `"TFRC Wholesale Services" <${user}>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });

  const email = escapeHtml(input.loginEmail);
  const ip = escapeHtml(input.ipAddress);
  const agent = escapeHtml(input.userAgent || "Unknown browser");
  const approvalUrl = escapeHtml(input.approvalUrl);

  await transporter.sendMail({
    from,
    to: APPROVAL_RECIPIENT,
    subject: "TFRC Admin login approval required",
    text:
      `A user entered the correct TFRC admin credentials.\n\n` +
      `Account: ${input.loginEmail}\nIP: ${input.ipAddress}\n` +
      `Browser: ${input.userAgent}\n\n` +
      `Review and authenticate this request within ${input.expiresMinutes} minutes:\n` +
      input.approvalUrl,
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
          <a href="${approvalUrl}"
             style="display:inline-block;background:#7B2D8E;color:#fff;text-decoration:none;
                    font-weight:700;padding:13px 22px;border-radius:9px">
            Review &amp; Authenticate
          </a>
          <p style="font-size:12px;color:#817985;margin-top:20px;line-height:1.5">
            Expires in ${input.expiresMinutes} minutes. If you did not expect this request,
            do not approve it. Opening the link does not approve automatically; a final
            confirmation click is required.
          </p>
        </div>
      </div>
    `,
  });
}
