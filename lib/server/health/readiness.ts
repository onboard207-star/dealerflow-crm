export interface ReadinessCheck {
  name: string;
  check: () => Promise<void>;
}

export interface ReadinessResult {
  ready: boolean;
  checks: ReadonlyArray<{
    name: string;
    status: "ready" | "unavailable";
  }>;
}

export async function evaluateReadiness(
  checks: readonly ReadinessCheck[],
): Promise<ReadinessResult> {
  const results = await Promise.all(
    checks.map(async ({ check, name }) => {
      try {
        await check();
        return { name, status: "ready" as const };
      } catch {
        return { name, status: "unavailable" as const };
      }
    }),
  );

  return {
    ready: results.every((result) => result.status === "ready"),
    checks: results,
  };
}
