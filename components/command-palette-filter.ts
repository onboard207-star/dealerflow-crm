import type { NavigationGroup } from "@/components/app-shell/navigation";
export function filterNavigationCommands(navigation:NavigationGroup[],query:string){const normalized=query.trim().toLowerCase();return navigation.flatMap((group)=>group.items.map((item)=>({...item,group:group.label}))).filter((item)=>`${item.label} ${item.group}`.toLowerCase().includes(normalized));}
