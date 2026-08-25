import { describe, expect, it } from "vitest";
import { createPasswordResetEmail, createVerificationEmail } from "./templates";

describe("account email templates", () => {
  it("provides equivalent text and HTML verification actions", () => {
    const message = createVerificationEmail({ recipientEmail: "alex@example.com", actionUrl: "https://crm.example.com/verify?token=abc", idempotencyKey: "verify:abc" });
    expect(message.textBody).toContain("https://crm.example.com/verify?token=abc");
    expect(message.htmlBody).toContain("https://crm.example.com/verify?token=abc");
    expect(message.kind).toBe("email-verification");
  });

  it("escapes attacker-controlled values in HTML", () => {
    const message = createPasswordResetEmail({ recipientEmail: "a@example.com<script>", actionUrl: "https://crm.example.com/reset?a=1&b=2\"", idempotencyKey: "reset:abc" });
    expect(message.htmlBody).not.toContain("<script>");
    expect(message.htmlBody).toContain("&amp;");
    expect(message.kind).toBe("password-reset");
  });
});
