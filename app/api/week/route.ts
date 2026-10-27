import { NextResponse } from "next/server";
import { getClientId } from "@/lib/client";
import { getWeek, localDate } from "@/lib/coach/today";

export async function GET(req: Request) {
  const clientId = await getClientId();
  const date = new URL(req.url).searchParams.get("date") ?? localDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  return NextResponse.json(await getWeek(clientId, date));
}
