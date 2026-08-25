import type { TransactionalEmailMessage } from "@/lib/application/email";

interface AccountEmailInput {
  recipientEmail: string;
  actionUrl: string;
  idempotencyKey: string;
}

export function createOrganizationInvitationEmail(input: AccountEmailInput & { organizationName: string }): TransactionalEmailMessage {
  return createActionEmail(input, {
    kind: "organization-invitation",
    subject: `Join ${input.organizationName} in DealerFlow`,
    heading: `You’re invited to ${input.organizationName}`,
    instruction: "Accept this invitation to access your dealership workspace. This secure invitation expires in seven days.",
    action: "Accept invitation",
  });
}

export function createVerificationEmail(input: AccountEmailInput): TransactionalEmailMessage {
  return createActionEmail(input, {
    kind: "email-verification",
    subject: "Verify your DealerFlow email",
    heading: "Verify your email",
    instruction: "Confirm this email address to finish securing your DealerFlow account.",
    action: "Verify email",
  });
}

export function createPasswordResetEmail(input: AccountEmailInput): TransactionalEmailMessage {
  return createActionEmail(input, {
    kind: "password-reset",
    subject: "Reset your DealerFlow password",
    heading: "Reset your password",
    instruction: "Use this secure link to choose a new DealerFlow password. If you did not request this, you can ignore this email.",
    action: "Reset password",
  });
}

function createActionEmail(
  input: AccountEmailInput,
  content: { kind: TransactionalEmailMessage["kind"]; subject: string; heading: string; instruction: string; action: string },
): TransactionalEmailMessage {
  const safeUrl = escapeHtml(input.actionUrl);
  const textBody = `${content.heading}\n\n${content.instruction}\n\n${input.actionUrl}\n\nThis link is intended only for ${input.recipientEmail}.`;
  const htmlBody = `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#172033;line-height:1.5"><main style="max-width:560px;margin:0 auto;padding:32px 20px"><p style="font-weight:700">DealerFlow</p><h1 style="font-size:24px">${content.heading}</h1><p>${content.instruction}</p><p style="margin:28px 0"><a href="${safeUrl}" style="background:#172033;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">${content.action}</a></p><p style="font-size:13px;color:#5f6b7a">This link is intended only for ${escapeHtml(input.recipientEmail)}.</p></main></body></html>`;
  return { kind: content.kind, recipientEmail: input.recipientEmail, subject: content.subject, textBody, htmlBody, idempotencyKey: input.idempotencyKey };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}
