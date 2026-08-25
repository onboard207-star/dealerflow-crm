import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function ProductEntryPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  redirect(session ? "/select-organization" : "/login");
}
