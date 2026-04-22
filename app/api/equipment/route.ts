import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const equipment = await db.equipment.findMany({ orderBy: { category: "asc" } });
  return NextResponse.json(equipment);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, category } = body;
  const item = await db.equipment.create({ data: { name, category } });
  return NextResponse.json(item);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.equipment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
