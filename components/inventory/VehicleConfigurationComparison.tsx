import type { VehicleConfigurationComparison } from "@/lib/application/vehicle-catalog";

export function VehicleConfigurationComparison({ comparison }: { comparison: VehicleConfigurationComparison }) {
  return <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6" aria-labelledby="vehicle-comparison-heading">
    <h2 id="vehicle-comparison-heading" className="text-lg font-semibold">Vehicle comparison</h2>
    <p className="mt-1 text-sm text-muted-foreground">Canonical configuration facts. Unavailable information is never treated as zero.</p>
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[44rem] border-collapse text-left text-sm">
      <caption className="sr-only">Comparison of selected vehicle configurations</caption>
      <thead><tr className="border-b"><th className="p-3 font-medium">Fact</th>{comparison.configurations.map((item)=><th className="p-3 font-semibold" key={item.id}>{item.modelYear.year} {item.make.name} {item.model.name}<span className="block text-xs font-normal text-muted-foreground">{item.trim.name} · {item.name}</span></th>)}</tr></thead>
      <tbody>{comparison.facts.map((fact)=><tr className="border-b last:border-0" key={fact.key}><th className="p-3 font-medium">{fact.label}</th>{fact.values.map((item)=><td className="p-3 align-top" key={item.configurationId}>{item.value ?? <span className="text-muted-foreground">Unavailable</span>}<span className="mt-1 block text-xs text-muted-foreground">{item.state}</span></td>)}</tr>)}</tbody>
    </table></div>
  </section>;
}
