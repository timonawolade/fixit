import { NextResponse } from "next/server";
import { loadHome, saveHome } from "@/lib/db";

export async function POST(req) {
  try {
    const { userId } = await req.json();
    const home = await loadHome(userId);
    home.repairs = [];
    await saveHome(userId, home);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}