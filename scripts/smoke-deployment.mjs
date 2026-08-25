const baseUrl = requiredUrl(process.env.DEALERFLOW_SMOKE_BASE_URL);
const jobSecret = process.env.DEALERFLOW_JOB_SECRET?.trim();

await verifyJson("liveness", "/api/health", 200, (body) => body.status === "ok");
await verifyJson("readiness", "/api/ready", 200, (body) => body.status === "ready");
await verifyPage("login", "/login", 200);
await verifyJson("protected job rejects anonymous access", "/api/internal/jobs/transactional-email", 401, (body) => body.error === "unauthorized");
await verifyJson("outbound worker rejects anonymous access", "/api/internal/jobs/outbound-messages", 401, (body) => body.error === "unauthorized", {}, "POST");
if (jobSecret) await verifyJson("transactional email telemetry", "/api/internal/jobs/transactional-email", 200, (body) => typeof body.counts === "object", { authorization: `Bearer ${jobSecret}` });
else process.stdout.write("SKIP transactional email telemetry (DEALERFLOW_JOB_SECRET not supplied)\n");

function requiredUrl(value) {
  if (!value) throw new Error("DEALERFLOW_SMOKE_BASE_URL is required.");
  const url = new URL(value);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Smoke tests require HTTPS outside localhost.");
  return url;
}
async function verifyPage(name, path, status) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
  if (response.status !== status) throw new Error(`${name} returned HTTP ${response.status}; expected ${status}.`);
  verifySecurityHeaders(name, response);
  process.stdout.write(`PASS ${name}\n`);
}
async function verifyJson(name, path, status, validate, headers = {}, method = "GET") {
  const response = await fetch(new URL(path, baseUrl), { headers, method, redirect: "manual" });
  const body = await response.json().catch(() => null);
  if (response.status !== status || !body || !validate(body)) throw new Error(`${name} failed its response contract (HTTP ${response.status}).`);
  if (response.headers.get("cache-control")?.toLowerCase().includes("no-store") !== true) throw new Error(`${name} must return Cache-Control: no-store.`);
  verifySecurityHeaders(name, response);
  process.stdout.write(`PASS ${name}\n`);
}
function verifySecurityHeaders(name, response) {
  const expected = { "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "strict-origin-when-cross-origin", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin" };
  for (const [header, value] of Object.entries(expected)) if (response.headers.get(header) !== value) throw new Error(`${name} is missing the expected ${header} security policy.`);
  if (!response.headers.get("permissions-policy")?.includes("camera=()")) throw new Error(`${name} is missing the expected browser permissions policy.`);
  const contentSecurityPolicy = response.headers.get("content-security-policy");
  if (!contentSecurityPolicy?.includes("object-src 'none'") || !contentSecurityPolicy.includes("frame-ancestors 'none'") || !contentSecurityPolicy.includes("form-action 'self'")) throw new Error(`${name} is missing the expected Content Security Policy.`);
  if (baseUrl.protocol === "https:" && !response.headers.get("strict-transport-security")?.includes("max-age=31536000")) throw new Error(`${name} is missing HTTP strict transport security.`);
}
