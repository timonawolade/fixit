import { NextResponse } from "next/server";
import { loadHome } from "@/lib/db";
import { addAppliance, addRepair } from "@/lib/memory";
import { diagnose } from "@/lib/agent";

export async function GET() {
  const userId = "default-home";

  // seed once, only if this home is empty, so memory has something to recall
  const home = await loadHome(userId);
  if (home.appliances.length === 0) {
    await addAppliance(userId, {
      name: "Washing machine",
      brand: "Bosch",
      location: "Kitchen",
      installedYear: 2021,
    });
    await addRepair(userId, {
      problem: "Washing machine wouldn't drain",
      diagnosis: "Clogged drain pump filter",
      fixTried: "Cleaned the filter",
      worked: true,
    });
  }

  const { memoryMode, result } = await diagnose(userId, [
    {
      role: "user",
      content:
        "My Bosch washing machine isn't draining again — water just sits in the drum after a cycle.",
    },
  ]);

  return NextResponse.json({ ok: true, memoryMode, result });
}