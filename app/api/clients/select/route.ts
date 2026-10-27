import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody, notFound } from "@/lib/api-util";
import { CLIENT_COOKIE } from "@/lib/client";

export async function POST(req: Request) {
  const p = await parseBody(req, z.object({ clientId: z.string() }));
  if ("res" in p) return p.res;
  if (!(await db.client.findFirst({ where: { id: p.data.clientId, active: true }, select: { id: true } }))) return notFound();
  (await cookies()).set(CLIENT_COOKIE, p.data.clientId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return NextResponse.json({ ok: true });
}
