import { NextResponse } from "next/server";
import { getClientId } from "@/lib/client";
import { getToday } from "@/lib/coach/today";

export async function GET() {
  const clientId = await getClientId();
  return NextResponse.json(await getToday(clientId));
}
