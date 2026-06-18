import { NextResponse } from "next/server";
import { loadHome } from "@/lib/db";

export async function GET(req) {
  const userId = new URL(req.url).searchParams.get("userId") || "default-home";
  const home = await loadHome(userId);
  const repairs = home.repairs.map(({ embedding, ...r }) => r); // drop bulky vectors
  return NextResponse.json({ ok: true, appliances: home.appliances, repairs });
}