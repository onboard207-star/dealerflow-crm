import { createHash, timingSafeEqual } from "node:crypto";

export function authenticateJobRequest(request: Request, expectedSecret: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ") || !expectedSecret) return false;
  const supplied = header.slice(7);
  if (!supplied || supplied.trim() !== supplied) return false;
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(expectedSecret).digest();
  return timingSafeEqual(suppliedHash, expectedHash);
}
