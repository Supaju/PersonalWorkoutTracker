import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";

export async function GET() {
  const clientId = await getClientId();
  const equipment = await db.equipment.findMany({ where: { clientId }, orderBy: { category: "asc" } });
  return NextResponse.json(equipment);
}

export async function POST(req: Request) {
  const clientId = await getClientId();
  const body = await req.json();
  const { name, category } = body;
  const item = await db.equipment.create({ data: { name, category, clientId } });
  return NextResponse.json(item);
}

export async function DELETE(req: Request) {
  const clientId = await getClientId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const existing = await db.equipment.findFirst({ where: { id, clientId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.equipment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
