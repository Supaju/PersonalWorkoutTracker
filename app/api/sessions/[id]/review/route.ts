import { NextResponse } from "next/server";
import { getClientId } from "@/lib/client";
import { ownedSession, notFound } from "@/lib/api-util";
import { reviewSession } from "@/lib/coach/engine";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId();
  const { id } = await params;
  if (!(await ownedSession(clientId, id))) return notFound();
  return NextResponse.json(await reviewSession(clientId, id));
}
