import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

function filePath(userId) {
  return path.join(DATA_DIR, `${userId}.json`);
}

export async function loadHome(userId) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(filePath(userId), "utf8");
    return JSON.parse(raw);
  } catch {
    return { appliances: [], repairs: [] };
  }
}

export async function saveHome(userId, data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath(userId), JSON.stringify(data, null, 2), "utf8");
}