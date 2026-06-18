import { NextResponse } from "next/server";
import { qwen } from "@/lib/qwen";
import { addAppliance, addRepair, recall } from "@/lib/memory";

export async function GET() {
  const userId = "default-home";

  // probe whether embeddings are available on your plan
  let embeddingWorks = false;
  let embeddingError = null;
  try {
    const e = await qwen.embeddings.create({
      model: "text-embedding-v4",
      input: "test",
    });
    embeddingWorks = Array.isArray(e.data?.[0]?.embedding);
  } catch (err) {
    embeddingError = err.message;
  }

  // seed one appliance + one past repair
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

  // ask something related — does it recall the past fix?
 const memory = await recall(userId, "water not draining from the washer");

  return NextResponse.json({ ok: true, embeddingWorks, embeddingError, memory });
}