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
  `AI for business automation agents enterprise pricing ${monthName} ${now.getFullYear()}`,
  `South Africa AI business news ${monthName} ${now.getFullYear()} mybroadband itweb techcentral`,
  `AI regulation POPIA data privacy Africa ${monthName} ${now.getFullYear()}`,
];

// AI Guide's own evergreen guides. The synthesiser maps each news item to the single most
// relevant one so the daily brief funnels readers into the pillar content (internal links =
// SEO + the path to the Zaiq funnel). relatedGuide must be one of these exact paths or "".
const GUIDES = [
  { path: "/guides/ai-popia-data-safety", title: "AI and POPIA: is your data safe with AI tools?", hint: "POPIA, data privacy, is your data safe with AI tools" },
  { path: "/guides/popia-compliant-ai-tools-south-africa", title: "POPIA-compliant AI tools for South African business", hint: "choosing POPIA-compliant tools, data residency" },
  { path: "/guides/can-you-put-customer-data-in-chatgpt-south-africa", title: "Can you put customer data into ChatGPT in South Africa?", hint: "putting customer data into ChatGPT or an LLM" },
  { path: "/guides/ai-automation-small-business-south-africa", title: "AI automation for South African small business: where to start", hint: "AI automation and agents for small business" },
  { path: "/guides/automate-your-south-african-business", title: "Automate your South African business: what to fix first", hint: "what to automate first, agents doing real work" },
  { path: "/guides/chatgpt-vs-gemini-vs-perplexity-for-business", title: "ChatGPT vs Gemini vs Perplexity for a South African business", hint: "comparing assistants, a new model release, which to use" },
  { path: "/guides/ai-benchmarks-explained", title: "The AI benchmarks, explained for a normal person", hint: "benchmark scores and what model capability claims mean" },
  { path: "/guides/ai-tools-for-small-business-south-africa", title: "The best AI tools for a South African small business (2026)", hint: "specific AI tools and apps for an SME" },
  { path: "/guides/ai-customer-service-whatsapp-south-africa", title: "AI customer service on WhatsApp for South African business", hint: "customer service, chatbots, WhatsApp" },
  { path: "/guides/get-found-on-ai-search-south-africa", title: "How to get found on AI search in South Africa", hint: "GEO and AEO, being found and cited by AI search" },
  { path: "/guides/does-chatgpt-recommend-your-business", title: "Does ChatGPT recommend your business?", hint: "whether AI engines recommend a business" },
  { path: "/guides/how-to-write-content-ai-will-cite", title: "How to write content that AI engines will cite", hint: "writing content AI engines will cite" },
  { path: "/guides/is-ai-worth-it-south-africa", title: "Is AI worth it for a South African business in 2026?", hint: "ROI, cost vs benefit, the adoption decision" },
  { path: "/guides/overhyped-ai-for-south-african-business", title: "Overhyped AI for South African business", hint: "hype versus reality, healthy scepticism" },
  { path: "/guides/ai-for-south-african-business", title: "AI for South African business: the practical 2026 guide", hint: "general AI for SA business, the default hub" },
];
const GUIDE_BY_PATH = new Map(GUIDES.map((g) => [g.path, g]));

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
  const guideList = GUIDES.map((g) => `${g.path} :: ${g.hint}`).join("\n");
  const system = `You are the senior analyst writing AI Guide's daily AI brief for South African business owners and operators. AI Guide is THE authoritative, no-hype source on what AI means for South African business. People read this instead of the global tech press for one reason: you translate global AI news into what it concretely means for someone running a business in South Africa. If an item does not earn that translation, it does not belong in the brief.

Strict rules:
- Ground every item ONLY in the SOURCES provided. Never invent facts, numbers, dates, model names, prices or quotes. If it is not in the sources, do not write it.
- Select the 5 to 8 MOST significant, genuinely newsworthy and recent developments. Ignore rumour, marketing, listicles, opinion fluff and trivia.
- The "soWhat" is the entire reason this brief exists, so make it CONCRETE and specific to operating in South Africa. Wherever the source allows, anchor it to at least one of: whether the tool or model is actually available to use from South Africa; the cost in rand (convert any USD figure and label it approximate, for example "about R1,850 a month"); the POPIA or regulatory angle; the connectivity or load-shedding reality; or a concrete local example such as a Takealot seller, a small law firm, an accountant filing with SARS, or a WhatsApp-first customer base. Never write a vague line like "businesses should consider leveraging this". If an item genuinely has no South African implication yet, say so plainly and briefly explain why it does not change anything for an SA business right now.
- Plain, sharp, factual English. Short sentences. No hype words like revolutionary, game-changer, unleash or supercharge. NO em-dashes. NO emojis. No exclamation marks.
- Each item cites the exact source URL it came from in sourceUrl.
- For each item set "relatedGuide" to the single most relevant guide PATH from RELATED GUIDES below, copied EXACTLY, or "" if none is a genuine fit. Do not invent paths.
- Do not repeat these headlines already covered recently: ${avoid.join(" | ") || "(none)"}

RELATED GUIDES (pick relatedGuide only from these exact paths):
${guideList}

Return ONLY valid JSON, no markdown fences:
{"summary":"2 to 3 sentences on what actually mattered today and why an SA operator should care","items":[{"headline":"short, specific, factual headline","what":"2 to 3 sentences on what happened, grounded strictly in the source","soWhat":"1 to 2 sentences, concrete and specific to a South African business per the rules above","sourceName":"publication or site name","sourceUrl":"https://...","relatedGuide":"/guides/... or empty string"}]}`;
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
    .slice(0, 8)
    .map((it) => {
      const g = it.relatedGuide && GUIDE_BY_PATH.get(it.relatedGuide.trim());
      const { relatedGuide, ...rest } = it;
      return g ? { ...rest, relatedPath: g.path, relatedTitle: g.title } : rest;
    });
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
