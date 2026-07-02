import { qwen, QWEN_MODEL } from "@/lib/qwen";
import { recall } from "@/lib/memory";

function formatAppliances(appliances) {
  if (!appliances.length) return "None recorded yet.";
  return appliances
    .map((a) => {
      const bits = [a.name];
      if (a.brand) bits.push(`(${a.brand}${a.model ? " " + a.model : ""})`);
      if (a.location) bits.push(`— ${a.location}`);
      if (a.installedYear) bits.push(`, since ${a.installedYear}`);
      return "- " + bits.join(" ");
    })
    .join("\n");
}

function formatMemory(memory) {
  if (!memory.recalled.length) return "No related past repairs or patterns found.";
  const lines = memory.recalled.map((m) => {
    const w = m.weight.toFixed(2);
    if (m.kind === "pattern") {
      return `- [LEARNED PATTERN, weight ${w}, from ${m.sourceCount} past repairs] ${m.insight}`;
    }
    const outcome = m.worked === true ? "this WORKED" : m.worked === false ? "this DID NOT work" : "outcome unknown";
    return `- [past repair, weight ${w}] "${m.problem}" → diagnosed as ${m.diagnosis}; tried: ${m.fixTried} (${outcome}).`;
  });
  if (memory.compressedSummary) lines.push(`- [compressed] ${memory.compressedSummary}`);
  return lines.join("\n");
}

const SHAPE = `{
  "needsClarification": boolean,
  "clarifyingQuestions": string[],
  "recalledContext": string,
  "diagnosis": string,
  "steps": [{ "title": string, "detail": string }],
  "recommendation": "diy" | "pro" | "diy-then-pro",
  "recommendationReason": string,
  "estimatedCost": string,
  "safety": string[],
  "disclaimer": string
}`;

export async function diagnose(userId, messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const memory = await recall(userId, lastUser?.content || "");

  const system = `You are FixIt, an expert home-repair diagnostic agent covering appliances, plumbing, and basic electrical work. You remember this specific household and use its history to give grounded, personal advice.

THE USER'S HOME:
${formatAppliances(memory.appliances)}

RELEVANT MEMORY (weighted by outcome, recency, and similarity; token-budgeted):
${formatMemory(memory)}

HOW TO USE MEMORY:
- LEARNED PATTERNS are your most reliable knowledge — trust them first.
- Higher weight = more trustworthy. A fix marked "this WORKED" should be your leading hypothesis for similar problems; a fix marked "this DID NOT work" must NOT be recommended again for the same problem — propose the next most likely cause instead.
- If you used a memory, reference it explicitly in recalledContext (e.g. "Last time your washer had this, cleaning the drain pump filter fixed it").

RULES:
- If the problem is too vague to diagnose safely, set needsClarification true and ask up to 3 specific clarifyingQuestions instead of guessing.
- Otherwise diagnose the most likely cause and give first-fix steps the user can safely attempt themselves.
- Always weigh DIY vs a professional. Anything involving gas, mains/high-voltage electrical, structural work, or sewage must recommend a pro.
- Never invent details about their appliance you were not told. Be honest about uncertainty.

Respond with ONLY a raw JSON object (no markdown, no code fences) in exactly this shape:
${SHAPE}`;

  const completion = await qwen.chat.completions.create({
    model: QWEN_MODEL,
    temperature: 0.4,
    enable_thinking: false,
    messages: [{ role: "system", content: system }, ...messages],
  });

  const raw = completion.choices[0]?.message?.content || "";
  const clean = raw.replace(/```json|```/g, "").trim();

  let result;
  try {
    result = JSON.parse(clean);
  } catch {
    result = {
      needsClarification: false,
      clarifyingQuestions: [],
      recalledContext: "",
      diagnosis: raw,
      steps: [],
      recommendation: "diy",
      recommendationReason: "",
      estimatedCost: "",
      safety: [],
      disclaimer: "FixIt gives general guidance, not certified professional repair advice.",
    };
  }

  return { memoryMode: memory.mode, memoryStats: memory.stats, result };
}