import { describe, expect, it } from "vitest";
import { authenticateJobRequest, diagnoseJobRequest } from "./authenticate-job";
describe("authenticateJobRequest", () => { const secret = "a-high-entropy-job-secret-123456789"; it("accepts only the exact bearer secret", () => { expect(authenticateJobRequest(new Request("https://crm.example.com", { headers: { authorization: `Bearer ${secret}` } }), secret)).toBe(true); expect(authenticateJobRequest(new Request("https://crm.example.com", { headers: { authorization: "Bearer wrong" } }), secret)).toBe(false); }); it("rejects missing and malformed credentials", () => { expect(authenticateJobRequest(new Request("https://crm.example.com"), secret)).toBe(false); expect(authenticateJobRequest(new Request("https://crm.example.com", { headers: { authorization: secret } }), secret)).toBe(false); }); });

describe("diagnoseJobRequest", () => {
  const secret = "a-high-entropy-job-secret-123456789";
  it("reports safe deterministic metadata without raw credentials", () => {
    const raw = `Bearer ${secret}`;
    const result = diagnoseJobRequest(new Request("https://crm.example.com", { headers: { authorization: raw } }), secret);
    expect(result).toMatchObject({ authorizationHeaderPresent: true, bearerPrefixValid: true, suppliedTokenLength: secret.length, expectedTokenLength: secret.length, fingerprintsMatch: true });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.suppliedFingerprint).toHaveLength(12);
    expect(result.expectedFingerprint).toHaveLength(12);
    expect(result.suppliedFingerprint).not.toMatch(/^[0-9a-f]{64}$/);
  });
  it("distinguishes missing and malformed headers", () => {
    expect(diagnoseJobRequest(new Request("https://crm.example.com"), secret)).toMatchObject({ authorizationHeaderPresent: false, bearerPrefixValid: false, suppliedTokenLength: 0, fingerprintsMatch: false });
    expect(diagnoseJobRequest(new Request("https://crm.example.com", { headers: { authorization: secret } }), secret)).toMatchObject({ authorizationHeaderPresent: true, bearerPrefixValid: false, suppliedTokenLength: 0, fingerprintsMatch: false });
  });
});
