import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const profile = await db.userProfile.findFirst({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(profile);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, age, gender, heightFt, heightIn, weightLbs, goals } = body;
  const totalInches = Number(heightFt) * 12 + Number(heightIn);

  const existing = await db.userProfile.findFirst();

  const profile = existing
    ? await db.userProfile.update({
        where: { id: existing.id },
        data: { name, age: Number(age), gender, heightIn: totalInches, weightLbs: Number(weightLbs), goals },
      })
    : await db.userProfile.create({
        data: { name, age: Number(age), gender, heightIn: totalInches, weightLbs: Number(weightLbs), goals },
      });

  return NextResponse.json(profile);
}
