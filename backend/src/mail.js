import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

const fromAddress = process.env.MAIL_FROM || "POS inc <no-reply@pos-inc.app>";

export async function sendWelcomeEmail({ to, name, businessName }) {
  return sendMail({
    to,
    subject: "Welcome to POS inc",
    text: `Hello ${name},\n\nYour POS inc account for ${businessName} has been created.\n\nYou can now sign in to your workspace.\n\nPOS inc`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Your POS inc account for <strong>${escapeHtml(businessName)}</strong> has been created.</p><p>You can now sign in to your workspace.</p><p>POS inc</p>`
  });
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  return sendMail({
    to,
    subject: "Reset your POS inc password",
    text: `Hello ${name},\n\nUse this link to reset your POS inc password:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.\n\nPOS inc`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Use this link to reset your POS inc password:</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p><p>POS inc</p>`
  });
}

async function sendMail(message) {
  if (!transporter) {
    console.warn(`Email not sent because SMTP is not configured. To: ${message.to}; Subject: ${message.subject}`);
    return { sent: false, skipped: true };
  }

  const result = await transporter.sendMail({
    from: fromAddress,
    ...message
  });
  return { sent: true, messageId: result.messageId };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
