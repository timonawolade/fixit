import { NextResponse } from "next/server";
import { addAppliance } from "@/lib/memory";

export async function POST(req) {
  try {
    const { userId = "default-home", appliance } = await req.json();
    const record = await addAppliance(userId, appliance);
    return NextResponse.json({ ok: true, appliance: record });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}