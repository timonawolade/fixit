import { qwen, QWEN_MODEL } from "@/lib/qwen";
import { loadHome, saveHome } from "@/lib/db";

const EMBED_MODEL = process.env.QWEN_EMBED_MODEL || "text-embedding-v4";

// ---- Memory tuning (Track 1 rubric knobs) ----
const HALF_LIFE_DAYS = 180;   // recency decay: weight halves every 180 days
const MIN_RECENCY = 0.25;     // old memories fade but never fully vanish
const SUPERSEDE_SIM = 0.62;   // "same problem, now solved" threshold
const TOKEN_BUDGET = 600;     // max tokens of memory injected into the agent's context
const MAX_RECALLED = 5;       // hard cap on full memories recalled
const CONSOLIDATE_MIN = 3;    // solved repairs needed to form a learned pattern
const CONSOLIDATE_SIM = 0.55; // similarity for clustering related repairs

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function embed(text) {
  try {
    const res = await qwen.embeddings.create({ model: EMBED_MODEL, input: text });
    return res.data[0].embedding;
  } catch {
    return null; // fall back to keyword matching
  }
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

function keywordSim(query, text) {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (!words.length) return 0;
  const t = text.toLowerCase();
  let hits = 0;
  for (const w of words) if (t.includes(w.slice(0, 4))) hits++;
  return hits / words.length; // normalized 0..1
}

function recencyFactor(createdAt) {
  const ageDays = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86400000);
  return Math.max(MIN_RECENCY, Math.pow(0.5, ageDays / HALF_LIFE_DAYS));
}

function outcomeConfidence(worked) {
  if (worked === true) return 0.9;
  if (worked === false) return 0.35;
  return 0.5;
}

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

function repairText(r) {
  return [r.problem, r.diagnosis, r.fixTried].filter(Boolean).join(" — ");
}

// ---------------- Appliances ----------------

export async function addAppliance(userId, appliance) {
  const home = await loadHome(userId);
  const record = { id: id(), createdAt: new Date().toISOString(), ...appliance };
  home.appliances.push(record);
  await saveHome(userId, home);
  return record;
}

// ---------------- Consolidation: merge related solved repairs into patterns ----------------

function centroid(vectors) {
  const dim = vectors[0].length;
  const c = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) c[i] += v[i];
  for (let i = 0; i < dim; i++) c[i] /= vectors.length;
  return c;
}

async function writeInsight(cluster) {
  const bullets = cluster.map((r) => `- ${repairText(r)}`).join("\n");
  try {
    const completion = await qwen.chat.completions.create({
      model: QWEN_MODEL,
      temperature: 0.2,
      enable_thinking: false,
      messages: [
        {
          role: "system",
          content:
            "You compress repair histories into one reusable insight. Respond with ONE sentence (max 30 words) stating the recurring problem and the fix that works. No preamble.",
        },
        { role: "user", content: bullets },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (text) return text.replace(/^["']|["']$/g, "");
  } catch {
    // fall through to template
  }
  const first = cluster[0];
  return `Recurring issue: "${first.problem}" — reliably fixed by: ${first.fixTried}.`;
}

async function consolidate(home) {
  const candidates = home.repairs.filter((r) => r.worked === true && r.embedding);
  const used = new Set();

  for (const seed of candidates) {
    if (used.has(seed.id)) continue;
    const cluster = candidates.filter(
      (r) => !used.has(r.id) && (r.id === seed.id || cosine(seed.embedding, r.embedding) >= CONSOLIDATE_SIM)
    );
    if (cluster.length < CONSOLIDATE_MIN) continue;

    cluster.forEach((r) => used.add(r.id));
    const insight = await writeInsight(cluster);

    home.patterns.push({
      id: id(),
      createdAt: new Date().toISOString(),
      insight,
      sourceIds: cluster.map((r) => r.id),
      sourceCount: cluster.length,
      embedding: centroid(cluster.map((r) => r.embedding)),
      confidence: 0.95,
      recallCount: 0,
      lastRecalledAt: null,
    });

    // Efficient storage: consolidated repairs leave active memory
    const clusterIds = new Set(cluster.map((r) => r.id));
    for (const r of home.repairs) {
      if (clusterIds.has(r.id)) {
        home.archived.push({ ...r, archivedAt: new Date().toISOString(), reason: "consolidated into pattern" });
      }
    }
    home.repairs = home.repairs.filter((r) => !clusterIds.has(r.id));
  }
}

// ---------------- Repairs (with outcome confidence + timely forgetting) ----------------

export async function addRepair(userId, repair) {
  const home = await loadHome(userId);
  const embedding = await embed(repairText(repair));

  const record = {
    id: id(),
    createdAt: new Date().toISOString(),
    confidence: outcomeConfidence(repair.worked),
    recallCount: 0,
    lastRecalledAt: null,
    embedding,
    ...repair,
  };

  // Timely forgetting: a fix that WORKED supersedes earlier FAILED attempts at the same problem
  if (repair.worked === true && embedding) {
    const keep = [];
    for (const r of home.repairs) {
      const sim = r.embedding ? cosine(embedding, r.embedding) : 0;
      if (r.worked === false && sim >= SUPERSEDE_SIM) {
        home.archived.push({ ...r, archivedAt: new Date().toISOString(), reason: "superseded by a working fix" });
      } else {
        keep.push(r);
      }
    }
    home.repairs = keep;
  }

  home.repairs.push(record);
  await consolidate(home);
  await saveHome(userId, home);
  return record;
}

// ---------------- Recall (weighted + token-budgeted) ----------------

export async function recall(userId, query, limit = MAX_RECALLED) {
  const home = await loadHome(userId);
  const qEmb = await embed(query);
  const mode = qEmb ? "semantic" : "keyword";

  const candidates = [
    ...home.patterns.map((p) => ({ ...p, kind: "pattern", text: p.insight })),
    ...home.repairs.map((r) => ({ ...r, kind: "repair", text: repairText(r) })),
  ];

  const scored = candidates
    .map((c) => {
      const sim = qEmb && c.embedding ? cosine(qEmb, c.embedding) : keywordSim(query, c.text);
      const weight = sim * (c.confidence ?? 0.5) * recencyFactor(c.createdAt);
      return { ...c, sim, weight };
    })
    .filter((c) => c.sim > (mode === "semantic" ? 0.25 : 0))
    .sort((a, b) => b.weight - a.weight);

  // Limited-context recall: spend the token budget on the highest-value memories
  let tokensUsed = 0;
  const recalled = [];
  const overflow = [];
  for (const c of scored) {
    const cost = estimateTokens(c.text) + 15; // text + framing overhead
    if (recalled.length < limit && tokensUsed + cost <= TOKEN_BUDGET) {
      recalled.push(c);
      tokensUsed += cost;
    } else {
      overflow.push(c);
    }
  }

  const compressedSummary =
    overflow.length > 0
      ? `${overflow.length} more related ${overflow.length === 1 ? "memory" : "memories"} omitted (lower relevance) to stay within the ${TOKEN_BUDGET}-token memory budget.`
      : "";

  // Track usage so recall telemetry improves across sessions
  if (recalled.length) {
    const now = new Date().toISOString();
    const ids = new Set(recalled.map((c) => c.id));
    for (const list of [home.repairs, home.patterns]) {
      for (const item of list) {
        if (ids.has(item.id)) {
          item.recallCount = (item.recallCount || 0) + 1;
          item.lastRecalledAt = now;
        }
      }
    }
    await saveHome(userId, home);
  }

  return {
    mode,
    appliances: home.appliances,
    recalled,
    compressedSummary,
    stats: {
      candidates: candidates.length,
      recalled: recalled.length,
      compressed: overflow.length,
      patterns: home.patterns.length,
      archived: home.archived.length,
      tokenBudget: TOKEN_BUDGET,
      tokensUsed,
      mode,
    },
  };
}
export async function removeAppliance(userId, applianceId) {
  const home = await loadHome(userId);
  home.appliances = home.appliances.filter((a) => a.id !== applianceId);
  await saveHome(userId, home);
  return { removed: applianceId };
}