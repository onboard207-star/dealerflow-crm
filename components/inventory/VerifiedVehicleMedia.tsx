import { CarFront, ShieldCheck } from "lucide-react";

export interface VerifiedVehicleMediaAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  altText: string;
  verifiedAt: string;
}

interface VerifiedVehicleMediaProps {
  assets: readonly VerifiedVehicleMediaAsset[];
}

export function VerifiedVehicleMedia({ assets }: VerifiedVehicleMediaProps) {
  if (!assets.length) {
    return (
      <section className="overflow-hidden rounded-xl border bg-card shadow-soft" aria-labelledby="media-heading">
        <h2 id="media-heading" className="sr-only">Vehicle media</h2>
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 bg-muted/30 p-8 text-center sm:min-h-96">
          <span className="flex size-16 items-center justify-center rounded-2xl border bg-background shadow-sm">
            <CarFront aria-hidden="true" className="size-8 text-muted-foreground" />
          </span>
          <div>
            <p className="font-medium">No verified unit photos available</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Photos appear here only after they are verified against this exact inventory unit.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const visibleAssets = assets.slice(0, 5);
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-soft" aria-labelledby="media-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="media-heading" className="font-medium">Vehicle photos</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          Verified unit photos
        </span>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2">
        {visibleAssets.map((asset, index) => (
          <figure key={asset.id} className={`relative bg-muted${index === 0 ? " sm:row-span-2" : ""}`}>
            {/* Provider URLs are validated HTTPS assets with immutable verification evidence. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={asset.altText}
              className={`h-full w-full object-cover${index === 0 ? " min-h-72 sm:min-h-96" : " min-h-48"}`}
              decoding="async"
              height={asset.height}
              loading={index === 0 ? "eager" : "lazy"}
              src={asset.url}
              width={asset.width}
            />
            <figcaption className="sr-only">
              Verified {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(asset.verifiedAt))}
            </figcaption>
          </figure>
        ))}
      </div>
      {assets.length > visibleAssets.length ? (
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          {assets.length - visibleAssets.length} additional verified photos are available.
        </p>
      ) : null}
    </section>
  );
}
