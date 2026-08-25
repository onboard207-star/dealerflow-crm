import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("release artifacts", () => {
  it("enforces the complete repository and container gate in CI", () => {
    const workflow = read(".github/workflows/quality.yml");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm validate");
    expect(workflow).toContain("git diff --check");
    expect(workflow).toContain("node --check scripts/provision-tenant.mjs");
    expect(workflow).toContain("docker build --target migrator");
    expect(workflow).toContain("docker build --target runner");
  });

  it("pins every third-party action to an immutable commit", () => {
    const workflow = read(".github/workflows/quality.yml");
    const actionReferences = workflow.match(/^\s*uses:.*$/gm) ?? [];

    expect(actionReferences).toHaveLength(3);
    for (const reference of actionReferences) {
      expect(reference).toMatch(
        /^\s*uses:\s+[\w.-]+\/[\w.-]+@[0-9a-f]{40}\s+#\s+v\d+\s*$/,
      );
    }
  });

  it("ships only the required runtime and includes migration provisioning assets", () => {
    const dockerfile = read("Dockerfile");
    expect(dockerfile).toContain("COPY drizzle ./drizzle");
    expect(dockerfile).toContain("COPY config ./config");
    expect(dockerfile).toContain("COPY scripts/provision-tenant.mjs");
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("/app/.next/standalone");
  });

  it("smoke-tests readiness, both protected workers, and browser security headers", () => {
    const smoke = read("scripts/smoke-deployment.mjs");
    expect(smoke).toContain('"/api/ready"');
    expect(smoke).toContain('"/api/internal/jobs/transactional-email"');
    expect(smoke).toContain('"/api/internal/jobs/outbound-messages"');
    expect(smoke).toContain('"x-frame-options"');
    expect(smoke).toContain('"strict-transport-security"');
    expect(smoke).toContain('"content-security-policy"');
  });
});
