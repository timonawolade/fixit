import { NextResponse } from "next/server";
import { loadHome } from "@/lib/db";

export async function GET(req) {
  try {
    const userId = req.nextUrl.searchParams.get("userId") || "default-home";
    const home = await loadHome(userId);
    return NextResponse.json({
      ok: true,
      appliances: home.appliances,
      repairs: home.repairs,
      patterns: home.patterns,
      archived: home.archived,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}