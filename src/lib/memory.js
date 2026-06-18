import { qwen } from "@/lib/qwen";
import { loadHome, saveHome } from "@/lib/db";

const EMBED_MODEL = process.env.QWEN_EMBED_MODEL || "text-embedding-v4";

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

function keywordScore(query, text) {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const t = text.toLowerCase();
  let score = 0;
  for (const w of words) if (t.includes(w.slice(0, 4))) score++;
  return score;
}

export async function addAppliance(userId, appliance) {
  const home = await loadHome(userId);
  const record = { id: id(), createdAt: new Date().toISOString(), ...appliance };
  home.appliances.push(record);
  await saveHome(userId, home);
  return record;
}

export async function addRepair(userId, repair) {
  const home = await loadHome(userId);
  const text = [repair.problem, repair.diagnosis, repair.fixTried].filter(Boolean).join(" — ");
  const embedding = await embed(text);
  const record = { id: id(), createdAt: new Date().toISOString(), embedding, ...repair };
  home.repairs.push(record);
  await saveHome(userId, home);
  return record;
}

export async function recall(userId, query, limit = 3) {
  const home = await loadHome(userId);
  const queryEmbedding = await embed(query);
  const mode = queryEmbedding ? "semantic" : "keyword";

  const scored = home.repairs.map((r) => {
    let score;
    if (queryEmbedding && r.embedding) {
      score = cosine(queryEmbedding, r.embedding);
    } else {
      const text = [r.problem, r.diagnosis, r.fixTried].filter(Boolean).join(" ");
      score = keywordScore(query, text);
    }
    return { ...r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const relevantRepairs = scored.filter((r) => r.score > 0).slice(0, limit);

  return { mode, appliances: home.appliances, relevantRepairs };
}