import type { CustomerRecommendation } from "@/lib/application/ai";
import { validateGeneration } from "@/lib/application/ai";
import {
  type DatabasePool,
  withTenantDatabaseContext,
} from "@/lib/server/database";

export interface CustomerRecommendationRun {
  id: string;
  status: "pending" | "completed" | "refused" | "failed";
  recommendation?: CustomerRecommendation;
  evidence: Array<{
    id: string;
    category: string;
    observation: string;
    observedAt: string;
  }>;
  refusal?: string;
  reviewDecision?: "accepted" | "dismissed";
  createdAt: string;
  updatedAt: string;
}

export class CustomerRecommendationReader {
  constructor(private readonly pool: DatabasePool) {}

  async latest(
    userId: string,
    organizationId: string,
    customerId: string,
  ): Promise<CustomerRecommendationRun | undefined> {
    return withTenantDatabaseContext(
      this.pool,
      { userId, organizationId },
      async (client) => {
        const result = (await client.query(
          `SELECT id, status::text, evidence, output, refusal,
                  review_decision::text, created_at, updated_at
             FROM ai_recommendation_runs
            WHERE organization_id = $1 AND customer_id = $2
            ORDER BY created_at DESC
            LIMIT 1`,
          [organizationId, customerId],
        )) as {
          rows: Array<{
            id: string;
            status: CustomerRecommendationRun["status"];
            evidence: Array<{
              id: string;
              category: "engagement" | "appointment" | "vehicle" | "deal" | "communication" | "task";
              observation: string;
              observedAt: string;
            }>;
            output: unknown;
            refusal: string | null;
            review_decision: "accepted" | "dismissed" | null;
            created_at: Date;
            updated_at: Date;
          }>;
        };
        const row = result.rows[0];
        if (!row) return undefined;

        let recommendation: CustomerRecommendation | undefined;
        if (row.status === "completed") {
          const generation = {
            providerResponseId: "stored",
            model: "stored",
            recommendation: row.output as CustomerRecommendation,
            latencyMs: 0,
          };
          validateGeneration(generation, row.evidence);
          recommendation = generation.recommendation;
        }

        return {
          id: row.id,
          status: row.status,
          evidence: row.evidence,
          ...(recommendation ? { recommendation } : {}),
          ...(row.refusal ? { refusal: row.refusal } : {}),
          ...(row.review_decision ? { reviewDecision: row.review_decision } : {}),
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        };
      },
    );
  }
}
