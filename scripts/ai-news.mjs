#!/usr/bin/env node
// AI Guide - automated daily SA AI brief.
// Firecrawl gathers the day's real AI developments; OpenRouter (DeepSeek) synthesises
// a sourced, South-Africa-business-lensed brief grounded ONLY in the scraped material.
// Output: src/data/ai-news/<YYYY-MM-DD>.json (rendered by src/pages/ai-news/*).
// House rules baked in: grounded-only (no invention), cite every item, SA business angle,
// curated 5-8 items (not a content farm), no em-dashes, no emojis. Aborts rather than
// publish an empty or thin brief.
import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FIRECRAWL = process.env.FIRECRAWL_API_KEY;
const OPENROUTER = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.AI_NEWS_MODEL || "deepseek/deepseek-chat-v3";
if (!FIRECRAWL || !OPENROUTER) {
  console.error("Missing FIRECRAWL_API_KEY or OPENROUTER_API_KEY");
  process.exit(1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "data", "ai-news");

const now = new Date();
const date = now.toISOString().slice(0, 10);
const dateHuman = now.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
const monthName = now.toLocaleString("en", { month: "long" });

const QUERIES = [
  `most significant AI announcement this week ${monthName} ${now.getFullYear()}`,
  `new frontier AI model release OpenAI Anthropic Google DeepSeek Mistral ${monthName} ${now.getFullYear()}`,
  `AI for business news automation agents pricing ${monthName} ${now.getFullYear()}`,
];

async function firecrawlSearch(query) {
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!r.ok) {
      console.error("  firecrawl", r.status, (await r.text()).slice(0, 160));
      return [];
    }
    const j = await r.json();
    return (j.data || []).map((x) => ({
      title: x.title || "",
      url: x.url,
      markdown: (x.markdown || x.description || "").slice(0, 4500),
    }));
  } catch (e) {
    console.error("  firecrawl error", String(e).slice(0, 120));
    return [];
  }
}

async function gather() {
  const seen = new Set();
  const out = [];
  for (const q of QUERIES) {
    console.log("  search:", q);
    for (const r of await firecrawlSearch(q)) {
      if (r.url && !seen.has(r.url) && (r.markdown || "").length > 250) {
        seen.add(r.url);
        out.push(r);
      }
    }
  }
  return out.slice(0, 12);
}

async function recentHeadlines() {
  try {
    const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 3);
    const hs = [];
    for (const f of files) {
      const d = JSON.parse(await readFile(join(OUT_DIR, f), "utf8"));
      for (const it of d.items || []) hs.push(it.headline);
    }
    return hs;
  } catch {
    return [];
  }
}

function prompt(sources, avoid) {
  const ctx = sources.map((s, i) => `SOURCE ${i + 1}: ${s.title}\nURL: ${s.url}\n${s.markdown}`).join("\n\n---\n\n");
  const system = `You are the senior analyst writing AI Guide's daily AI brief for South African business owners and operators. AI Guide is the authoritative, no-hype source on what AI means for South African business.

Strict rules:
- Ground every item ONLY in the SOURCES provided. Never invent facts, numbers, dates, model names, prices or quotes. If it is not in the sources, do not write it.
- Select the 5 to 8 MOST significant, genuinely newsworthy and recent developments. Ignore rumour, marketing, listicles, opinion fluff and trivia.
- Every item needs a short "so what for a South African business": the practical implication, in rand where a price is involved, noting POPIA or local availability when relevant. This SA lens is the entire point.
- Plain, sharp, factual English. No hype words like revolutionary or game-changer. NO em-dashes. NO emojis.
- Each item cites the exact source URL it came from.
- Do not repeat these headlines already covered recently: ${avoid.join(" | ") || "(none)"}

Return ONLY valid JSON, no markdown fences:
{"summary":"2 to 3 sentences on what mattered","items":[{"headline":"short headline","what":"2 to 3 sentences, what happened, grounded in the source","soWhat":"1 to 2 sentences, what it means for a South African business","sourceName":"publication or site name","sourceUrl":"https://..."}]}`;
  const user = `Today is ${dateHuman}. Write today's brief from these sources only.\n\n${ctx}`;
  return { system, user };
}

async function synthesize(sources, avoid) {
  const { system, user } = prompt(sources, avoid);
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://aiguide.co.za",
      "X-Title": "AI Guide daily brief",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 2400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error("openrouter " + r.status + " " + (await r.text()).slice(0, 300));
  const content = (await r.json()).choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content);
  } catch {
    return JSON.parse(content.match(/\{[\s\S]*\}/)[0]);
  }
}

(async () => {
  console.log("Gathering sources via Firecrawl...");
  const sources = await gather();
  console.log(`  ${sources.length} unique sources`);
  if (sources.length < 2) {
    console.error("Not enough sources; aborting (will not publish an empty brief).");
    process.exit(1);
  }
  const avoid = await recentHeadlines();
  console.log(`Synthesizing with ${MODEL} (avoiding ${avoid.length} recent headlines)...`);
  const brief = await synthesize(sources, avoid);
  const items = (brief.items || [])
    .filter((it) => it.headline && it.what && /^https?:\/\//.test(it.sourceUrl || ""))
    .slice(0, 8);
  if (items.length < 3) {
    console.error("Too few valid, sourced items; aborting.");
    process.exit(1);
  }
  const doc = {
    date,
    dateHuman,
    title: `AI brief for South African business, ${dateHuman}`,
    summary: brief.summary || "",
    items,
    sources: sources.map((s) => ({ name: s.title, url: s.url })),
    generatedAt: now.toISOString(),
    model: MODEL,
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, `${date}.json`), JSON.stringify(doc, null, 2));
  console.log(`\nWrote src/data/ai-news/${date}.json with ${items.length} items.`);
  console.log("SUMMARY:", doc.summary, "\n");
  for (const it of items) console.log(" -", it.headline, "\n   so-what:", it.soWhat, "\n   src:", it.sourceUrl);
})();
