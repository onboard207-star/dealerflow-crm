import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { assertAuthorized, AuthorizationError, type Capability } from "@/lib/platform/auth";
import { getAuth, MembershipError, PostgresMembershipReader, resolveAuthorizationActor } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { OrganizationDirectory, PostgresTenantConfigurationProvider } from "@/lib/server/organizations";

export async function loadDirectoryContext(organizationId: string, capability: Capability) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const pool = getDatabasePool();
  let actor;
  try {
    actor = await resolveAuthorizationActor(session.user.id, organizationId, new PostgresMembershipReader(pool));
    assertAuthorized(actor, { capability, organizationId });
  } catch (error) {
    if (error instanceof MembershipError || error instanceof AuthorizationError) notFound();
    throw error;
  }
  const organization = (await new OrganizationDirectory(pool).listForUser(session.user.id)).find((item) => item.id === organizationId);
  if (!organization) notFound();
  const configuration = (await new PostgresTenantConfigurationProvider(pool).read({ actorId: session.user.id, organizationId })).configuration;
  return { session, pool, actor, membership: actor.memberships[0]!, organization, configuration };
}
