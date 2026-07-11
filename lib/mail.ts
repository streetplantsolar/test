import nodemailer, { type Transporter } from "nodemailer";

// Outbound email. Configured entirely by environment:
//
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=hello.comn.one@gmail.com
//   SMTP_PASS=<16-char Google App Password — NOT the account password>
//   MAIL_FROM="Comn.one <hello.comn.one@gmail.com>"
//   APP_URL=https://comn.one          (used to build links in emails)
//
// When SMTP_HOST is unset (local dev), emails are logged to the server
// console instead of sent, so every flow stays testable offline.

export function emailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function appUrl(path: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

const g = globalThis as unknown as { __comnMailer?: Transporter };

function transporter(): Transporter {
  return (g.__comnMailer ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  }));
}

/**
 * Fire-and-forget send. Failures are logged, never thrown — a broken mail
 * server must not take page loads or the reminder sweep down with it.
 */
export function sendMail(to: string, subject: string, text: string): void {
  if (!emailEnabled()) {
    console.log(`[mail disabled] To: ${to} | ${subject}\n${text}`);
    return;
  }
  transporter()
    .sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    })
    .catch((err: unknown) => {
      console.error(`[mail] failed to send "${subject}" to ${to}:`, err);
    });
}
