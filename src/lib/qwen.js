import OpenAI from "openai";

export const qwen = new OpenAI({
  apiKey: process.env.QWEN_API_KEY,
  baseURL: process.env.QWEN_BASE_URL,
});

export const QWEN_MODEL = process.env.QWEN_MODEL || "qwen3.7-max";