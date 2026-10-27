import { NextResponse } from "next/server";
import { getClientId } from "@/lib/client";
import { runProgramReview } from "@/lib/coach/program-review";
import { localDate } from "@/lib/coach/today";

/** Client-requested review. Returns {proposalId} or {proposalId: null, reason}. */
export async function POST() {
  const clientId = await getClientId();
  return NextResponse.json(await runProgramReview(clientId, { today: localDate(), clientRequested: true }));
}
