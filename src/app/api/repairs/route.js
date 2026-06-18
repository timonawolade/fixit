import { NextResponse } from "next/server";
import { addRepair } from "@/lib/memory";

export async function POST(req) {
  try {
    const { userId = "default-home", repair } = await req.json();
    const record = await addRepair(userId, repair);
    const { embedding, ...clean } = record;
    return NextResponse.json({ ok: true, repair: clean });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}