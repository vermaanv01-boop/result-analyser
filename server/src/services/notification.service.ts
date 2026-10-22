import { Competition } from "../models/competition.model";
import { User } from "../models/user.model";
import {
  ActivationToken,
  generateActivationToken,
  hashActivationToken,
} from "../models/activation-token.model";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";
import { hashPassword } from "./auth.service";
import { sendEmailWithRetry } from "./email.service";

export interface SendParticipantRegistrationConfirmationOptions {
  email: string;
  participantName: string;
  competitionId: string;
  registrationId: string;
}

export interface SendJudgeActivationOptions {
  userId: string;
  email: string;
  name: string;
}

export async function sendParticipantRegistrationConfirmation(
  options: SendParticipantRegistrationConfirmationOptions,
): Promise<void> {
  const competition = await Competition.findById(options.competitionId);
  const competitionName = competition?.name ?? "Your competition";

  const appUrl = env.APP_PUBLIC_URL.replace(/\/$/, "");
  const portalLink = `${appUrl}/participant`;
  const loginLink = `${appUrl}/login`;

  const text =
    `Hello ${options.participantName},\n\n` +
    `Your registration has been confirmed.\n\n` +
    `Registration details:\n` +
    `- Competition: ${competitionName}\n` +
    `- Registration ID: ${options.registrationId}\n\n` +
    `You can sign in to access the participant portal:\n` +
    `- Login: ${loginLink}\n` +
    `- Participant portal: ${portalLink}\n\n` +
    `If you did not request this registration, please contact the event administrator.\n\n` +
    `— KARVAAN Team`;

  const html =
    `<p>Hello ${escapeHtml(options.participantName)},</p>` +
    `<p>Your registration has been confirmed.</p>` +
    `<p><strong>Registration details</strong></p>` +
    `<ul>` +
    `<li>Competition: ${escapeHtml(competitionName)}</li>` +
    `<li>Registration ID: ${escapeHtml(options.registrationId)}</li>` +
    `</ul>` +
    `<p>You can sign in to access the participant portal:</p>` +
    `<p><a href="${escapeAttribute(loginLink)}">Sign in</a> | <a href="${escapeAttribute(portalLink)}">Participant portal</a></p>` +
    `<p>If you did not request this registration, please contact the event administrator.</p>` +
    `<p>— KARVAAN Team</p>`;

  const result = await sendEmailWithRetry({
    to: options.email,
    subject: `KARVAAN registration confirmed — ${competitionName}`,
    text,
    html,
  });

  if (!result.delivered) {
    // Do not fail registration if email delivery fails; log a non-sensitive failure.
    console.error("Participant registration email delivery failed:", result.error ?? "unknown");
  }
}

export async function createJudgeActivationToken(userId: string): Promise<string> {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  if (user.role !== "judge") {
    throw ApiError.badRequest("Activation tokens can only be issued for judge accounts");
  }

  // Invalidate any existing unused tokens for this user.
  await ActivationToken.updateMany(
    { user: user._id, usedAt: null },
    { usedAt: new Date() },
  );

  const rawToken = generateActivationToken();
  const tokenHash = hashActivationToken(rawToken);
  const ttlHours = env.JUDGE_ACTIVATION_TOKEN_TTL_HOURS ?? 24;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await ActivationToken.create({
    user: user._id,
    tokenHash,
    expiresAt,
    usedAt: null,
  });

  return rawToken;
}

export async function sendJudgeActivationEmail(options: SendJudgeActivationOptions): Promise<void> {
  const user = await User.findById(options.userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  const rawToken = await createJudgeActivationToken(user._id.toString());
  const appUrl = env.APP_PUBLIC_URL.replace(/\/$/, "");
  const activationLink = `${appUrl}/judge/activate?token=${encodeURIComponent(rawToken)}`;

  const text =
    `Hello ${options.name},\n\n` +
    `A judge account has been created for you on KARVAAN.\n\n` +
    `To activate your account and set your password, use the link below (single-use, expires in ${env.JUDGE_ACTIVATION_TOKEN_TTL_HOURS ?? 24} hours):\n` +
    `${activationLink}\n\n` +
    `If you did not expect this email, please contact the event administrator.\n\n` +
    `— KARVAAN Team`;

  const html =
    `<p>Hello ${escapeHtml(options.name)},</p>` +
    `<p>A judge account has been created for you on KARVAAN.</p>` +
    `<p>To activate your account and set your password, click the link below (single-use, expires in ${env.JUDGE_ACTIVATION_TOKEN_TTL_HOURS ?? 24} hours):</p>` +
    `<p><a href="${escapeAttribute(activationLink)}">Activate judge account</a></p>` +
    `<p>If the button doesn't work, copy and paste this URL into your browser:</p>` +
    `<p>${escapeHtml(activationLink)}</p>` +
    `<p>If you did not expect this email, please contact the event administrator.</p>` +
    `<p>— KARVAAN Team</p>`;

  const result = await sendEmailWithRetry({
    to: options.email,
    subject: "KARVAAN judge account activation",
    text,
    html,
  });

  if (!result.delivered) {
    console.error("Judge activation email delivery failed:", result.error ?? "unknown");
  }
}

export async function activateJudgeAccount(
  token: string,
  newPassword: string,
): Promise<{ email: string; name: string }> {
  if (!token) {
    throw ApiError.badRequest("Activation token is required");
  }
  if (!newPassword || newPassword.length < 6) {
    throw ApiError.badRequest("Password must be at least 6 characters");
  }

  const tokenHash = hashActivationToken(token);
  const record = await ActivationToken.findOne({ tokenHash });

  if (!record) {
    throw ApiError.badRequest("Invalid activation token");
  }
  if (record.usedAt) {
    throw ApiError.badRequest("Activation token has already been used");
  }
  if (record.expiresAt < new Date()) {
    throw ApiError.badRequest("Activation token has expired");
  }

  const user = await User.findById(record.user).select("+passwordHash");
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  if (user.role !== "judge") {
    throw ApiError.badRequest("This activation token is not valid for this account");
  }

  user.passwordHash = await hashPassword(newPassword);
  user.isActive = true;
  await user.save();

  record.usedAt = new Date();
  await record.save();

  return { email: user.email, name: user.name };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
