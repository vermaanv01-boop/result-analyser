import nodemailer from "nodemailer";
import { env } from "../config/env";

export interface EmailAttachment {
  filename: string;
  content?: string | Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSendResult {
  delivered: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  const host = env.SMTP_HOST;
  const port = env.SMTP_PORT;

  if (!host || !port) {
    throw new Error(
      "Email delivery is not configured. Set SMTP_HOST and SMTP_PORT (and optionally SMTP_USER, SMTP_PASS, SMTP_FROM).",
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: env.SMTP_SECURE ?? port === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });

  return transporter;
}

function getFromAddress(): string {
  return env.SMTP_FROM ?? "KARVAAN <no-reply@karvaan.local>";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmailWithRetry(
  options: SendEmailOptions,
): Promise<EmailSendResult> {
  const retries = env.EMAIL_DELIVERY_RETRIES ?? 2;
  const delayMs = env.EMAIL_DELIVERY_RETRY_DELAY_MS ?? 250;
  const maxAttempts = Math.max(1, retries + 1);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const tx = getTransporter();
      const info = await tx.sendMail({
        from: getFromAddress(),
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });

      return {
        delivered: true,
        messageId: info.messageId,
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(delayMs * attempt);
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Unknown email delivery error";

  // Do not log credentials or secrets; only a non-sensitive message.
  return {
    delivered: false,
    error: message,
  };
}

export function resetEmailTransporterForTests(): void {
  transporter = null;
}
