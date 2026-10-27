import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";

export async function GET() {
  const clientId = await getClientId();
  const profile = await db.userProfile.findUnique({
    where: { clientId },
  });
  return NextResponse.json(profile);
}

export async function POST(req: Request) {
  const clientId = await getClientId();
  const body = await req.json();
  const { name, age, gender, heightFt, heightIn, weightLbs, goals } = body;
  const totalInches = Number(heightFt) * 12 + Number(heightIn);

  const profile = await db.userProfile.upsert({
    where: { clientId },
    update: { name, age: Number(age), gender, heightIn: totalInches, weightLbs: Number(weightLbs), goals },
    create: { clientId, name, age: Number(age), gender, heightIn: totalInches, weightLbs: Number(weightLbs), goals },
  });

  return NextResponse.json(profile);
}
