// The one place that decides which client a request is for. Every client-owned query filters by this id.
// No auth yet: the selected client is a cookie set by the client switcher.
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const CLIENT_COOKIE = "clientId";

export async function getClientId(): Promise<string> {
  const jar = await cookies();
  const selected = jar.get(CLIENT_COOKIE)?.value;
  if (selected) {
    const exists = await db.client.findFirst({ where: { id: selected, active: true }, select: { id: true } });
    if (exists) return exists.id;
  }
  const first = await db.client.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!first) throw new Error("No active client. Create one first.");
  return first.id;
}
