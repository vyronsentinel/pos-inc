import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const to = process.argv[2] || process.env.TEST_EMAIL || process.env.SMTP_TEST_TO;
const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"];
const missing = required.filter((key) => !process.env[key]);

if (!to) {
  console.error("Usage: npm run send-test-email -- you@example.com");
  process.exit(1);
}

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const result = await transporter.sendMail({
  from: process.env.MAIL_FROM,
  to,
  subject: "POS inc Brevo SMTP verification",
  text: "This is a POS inc SMTP verification email sent through Brevo."
});

console.log(`Sent Brevo SMTP test email: ${result.messageId}`);
