import { NextResponse } from "next/server";
import { diagnose } from "@/lib/agent";

export async function POST(req) {
  try {
    const { userId = "default-home", messages = [] } = await req.json();
    const { memoryMode, memoryStats, result } = await diagnose(userId, messages);
    return NextResponse.json({ ok: true, memoryMode, memoryStats, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}