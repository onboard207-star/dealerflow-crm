"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { VehicleConfigurationMatchService } from "@/lib/application/vehicle-catalog";
import { PostgresVehicleConfigurationMatchProvider } from "@/lib/server/vehicles";
import { loadDirectoryContext } from "../../_lib/load-directory-context";

export async function matchVehicleConfigurationAction(
  organizationId: string,
  inventoryUnitId: string,
  vehicleId: string,
  formData: FormData,
) {
  const path = `/organizations/${organizationId}/inventory/${inventoryUnitId}`;
  try {
    const context = await loadDirectoryContext(organizationId, "inventory.update");
    const configurationId = String(formData.get("configurationId") ?? "").trim();
    if (!configurationId) throw new Error("Choose a verified catalog configuration.");
    const result = await new VehicleConfigurationMatchService(
      new PostgresVehicleConfigurationMatchProvider(context.pool, {
        userId: context.session.user.id,
        organizationId,
      }),
    ).match({
      actor: context.actor,
      organizationId,
      vehicleId,
      configurationId,
      source: "vehicle-workspace-review",
    });
    revalidatePath(path);
    redirect(`${path}?notice=${encodeURIComponent(result.created ? "Vehicle Intelligence match verified." : "Existing verified match confirmed.")}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirect(`${path}?error=${encodeURIComponent(error instanceof Error ? error.message : "Vehicle Intelligence match could not be verified.")}`);
  }
}

function isRedirect(error: unknown) {
  return error instanceof Error && error.message === "NEXT_REDIRECT";
}
