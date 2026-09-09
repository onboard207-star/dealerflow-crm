import type { CatalogMatchConfiguration } from "@/lib/application/vehicle-catalog";
import { Button } from "@/components/ui/button";

interface VehicleCatalogMatchControlProps {
  action: (formData: FormData) => Promise<void>;
  configurations: readonly CatalogMatchConfiguration[];
}

export function VehicleCatalogMatchControl({
  action,
  configurations,
}: VehicleCatalogMatchControlProps) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6" aria-labelledby="catalog-match-heading">
      <h2 id="catalog-match-heading" className="text-lg font-semibold">Verify Vehicle Intelligence</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Match this physical vehicle to an eligible catalog configuration. VIN, stock, price, location, media, and inventory status will not change.
      </p>
      {configurations.length ? (
        <form action={action} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium" htmlFor="configurationId">
            Verified configuration
            <select
              className="focus-ring mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm"
              id="configurationId"
              name="configurationId"
              required
            >
              <option value="">Select a configuration</option>
              {configurations.map((configuration) => (
                <option key={configuration.id} value={configuration.id}>
                  {configuration.name ?? configuration.trim} · {configuration.trim} · {configuration.readiness.replace("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <Button className="min-h-11" type="submit">Verify match</Button>
        </form>
      ) : (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm" role="status">
          No verified or pilot-ready catalog configuration matches this vehicle&apos;s year, make, and model.
        </p>
      )}
    </section>
  );
}
