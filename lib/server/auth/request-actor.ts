import type { Pool } from "pg";

import {
  capabilities,
  type AuthorizationActor,
  type Capability,
} from "@/lib/platform/auth";
import { withTenantDatabaseContext } from "@/lib/server/database";

import { getAuth } from "./better-auth";

export class AuthenticationError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationError";
  }
}

export class MembershipError extends Error {
  readonly status = 403;

  constructor() {
    super("An active organization membership is required.");
    this.name = "MembershipError";
  }
}

export interface MembershipSnapshot {
  organizationId: string;
  allLocations: boolean;
  locationIds: readonly string[];
  capabilities: readonly string[];
  roleKeys?: readonly string[];
  features?: Readonly<Record<string, boolean>>;
}

export interface MembershipReader {
  readActiveMembership(
    userId: string,
    organizationId: string,
  ): Promise<MembershipSnapshot | null>;
}

export async function authenticateOrganizationRequest(
  request: Request,
  organizationId: string,
  membershipReader: MembershipReader,
): Promise<AuthorizationActor> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user.id) throw new AuthenticationError();

  return resolveAuthorizationActor(
    session.user.id,
    organizationId,
    membershipReader,
  );
}

export async function resolveAuthorizationActor(
  userId: string,
  organizationId: string,
  membershipReader: MembershipReader,
): Promise<AuthorizationActor> {
  const membership = await membershipReader.readActiveMembership(
    userId,
    organizationId,
  );
  if (!membership) throw new MembershipError();

  const allowedCapabilities = new Set<string>(capabilities);
  const resolvedCapabilities = membership.capabilities.filter(
    (capability): capability is Capability => allowedCapabilities.has(capability) && isCapabilityFeatureEnabled(capability as Capability, membership.features),
  );

  return {
    userId,
    memberships: [
      {
        organizationId: membership.organizationId,
        locationIds: membership.allLocations ? "all" : membership.locationIds,
        capabilities: resolvedCapabilities,
        ...(membership.roleKeys ? { roleKeys: membership.roleKeys } : {}),
        ...(membership.features ? { features: membership.features } : {}),
      },
    ],
  };
}

export class PostgresMembershipReader implements MembershipReader {
  constructor(private readonly pool: Pool) {}

  async readActiveMembership(userId: string, organizationId: string) {
    return withTenantDatabaseContext(
      this.pool,
      { userId, organizationId },
      async (client) => {
        const result = (await client.query(
          `SELECT m.organization_id, m.all_locations,
             COALESCE(array_agg(DISTINCT ml.location_id)
               FILTER (WHERE ml.location_id IS NOT NULL), '{}') AS location_ids,
             COALESCE(array_agg(DISTINCT rc.capability)
               FILTER (WHERE rc.capability IS NOT NULL), '{}') AS capabilities,
             COALESCE(array_agg(DISTINCT role.key)
               FILTER (WHERE role.key IS NOT NULL), '{}') AS role_keys,
             COALESCE(c.features, '{}'::jsonb) AS features
           FROM organization_memberships m
           JOIN users u ON u.id = m.user_id AND u.active = true
           JOIN organizations o ON o.id = m.organization_id AND o.active = true
           LEFT JOIN membership_locations ml ON ml.membership_id = m.id
             AND ml.organization_id = m.organization_id
           LEFT JOIN membership_roles mr ON mr.membership_id = m.id
             AND mr.organization_id = m.organization_id
           LEFT JOIN roles role ON role.id = mr.role_id
             AND role.organization_id = m.organization_id
           LEFT JOIN role_capabilities rc ON rc.role_id = mr.role_id
             AND rc.organization_id = m.organization_id
           LEFT JOIN organization_configurations c ON c.organization_id = m.organization_id
           WHERE m.user_id = $1 AND m.organization_id = $2 AND m.status = 'active'
           GROUP BY m.organization_id, m.all_locations, c.features`,
          [userId, organizationId],
        )) as {
          rows: Array<{
            organization_id: string;
            all_locations: boolean;
            location_ids: string[];
            capabilities: string[];
            role_keys: string[];
            features: Record<string, boolean>;
          }>;
        };
        const row = result.rows[0];
        return row
          ? {
              organizationId: row.organization_id,
              allLocations: row.all_locations,
              locationIds: row.location_ids,
              capabilities: row.capabilities,
              roleKeys: row.role_keys,
              features: row.features,
            }
          : null;
      },
    );
  }
}

const featureByCapability: Partial<Record<Capability, string>> = {
  "customer.read":"crm","customer.create":"crm","customer.update":"crm","lead.read":"crm","lead.create":"crm","lead.assign":"crm","lead.update":"crm","task.read":"crm","task.create":"crm","task.update":"crm","communication.read":"crm","communication.create":"crm","communication.consent.manage":"crm","communication.send":"crm","appointment.read":"crm","appointment.create":"crm","appointment.update":"crm","inventory.read":"inventory","inventory.create":"inventory","inventory.update":"inventory","deal.read":"finance","deal.create":"finance","deal.update":"finance","deal.approve":"finance","reports.view":"reporting",
};
function isCapabilityFeatureEnabled(capability:Capability,features:MembershipSnapshot["features"]){const feature=featureByCapability[capability];return !feature||features?.[feature]!==false;}
