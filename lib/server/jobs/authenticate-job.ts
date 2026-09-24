import { createHash, timingSafeEqual } from "node:crypto";

export interface JobAuthDiagnostic {
  authorizationHeaderPresent: boolean;
  bearerPrefixValid: boolean;
  suppliedTokenLength: number;
  expectedTokenLength: number;
  suppliedFingerprint: string;
  expectedFingerprint: string;
  fingerprintsMatch: boolean;
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function diagnoseJobRequest(request: Request, expectedSecret: string): JobAuthDiagnostic {
  const header = request.headers.get("authorization");
  const authorizationHeaderPresent = header !== null;
  const bearerPrefixValid = header?.startsWith("Bearer ") ?? false;
  const supplied = bearerPrefixValid ? header!.slice(7) : "";
  const expectedFingerprint = fingerprint(expectedSecret);
  const suppliedFingerprint = fingerprint(supplied);
  return {
    authorizationHeaderPresent,
    bearerPrefixValid,
    suppliedTokenLength: supplied.length,
    expectedTokenLength: expectedSecret.length,
    suppliedFingerprint,
    expectedFingerprint,
    fingerprintsMatch: suppliedFingerprint === expectedFingerprint,
  };
}

export function authenticateJobRequest(request: Request, expectedSecret: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ") || !expectedSecret) return false;
  const supplied = header.slice(7);
  if (!supplied || supplied.trim() !== supplied) return false;
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(expectedSecret).digest();
  return timingSafeEqual(suppliedHash, expectedHash);
}
