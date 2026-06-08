// Publish-check-lite: validates JSON-LD graph + content audits across the built site.
// Mirrors the load-bearing checks from skills/publish-checker.md (schema parse + required
// fields, em-dash=0, placeholder/LLM-tell scan). Run after `npm run build`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

const REQUIRED = {
  Article: ['headline', 'datePublished', 'author', 'publisher', 'mainEntityOfPage'],
  Person: ['name', 'url'],
  Organization: ['name', 'url'],
  WebSite: ['name', 'url'],
  WebPage: ['url'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  HowTo: ['name', 'step'],
};

const LLM_TELLS = [
  'lorem ipsum', 'TODO', '<fill-in>', 'placeholder', 'as an ai language model',
  'in conclusion,', 'in today’s fast-paced', "in today's fast-paced", 'delve into', 'tapestry of',
];

let pass = true;
const files = walk(DIST);
console.log(`\nValidating ${files.length} built pages\n${'='.repeat(60)}`);

for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const rel = f.split(/dist[\\/]/)[1];
  const problems = [];

  // 1. JSON-LD
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const typesSeen = new Set();
  if (blocks.length === 0) {
    problems.push('no JSON-LD block');
  }
  for (const b of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(b[1]);
    } catch (e) {
      problems.push(`JSON-LD parse error: ${e.message}`);
      continue;
    }
    const nodes = parsed['@graph'] || [parsed];
    const ids = new Set(nodes.map((n) => n['@id']).filter(Boolean));
    for (const node of nodes) {
      const t = node['@type'];
      typesSeen.add(t);
      const req = REQUIRED[t];
      if (req) {
        for (const field of req) {
          if (node[field] === undefined || node[field] === '' ||
              (Array.isArray(node[field]) && node[field].length === 0)) {
            problems.push(`${t} missing required field "${field}"`);
          }
        }
      }
      // dangling @id ref check (objects that are pure {'@id': ...} refs must resolve)
      for (const [k, v] of Object.entries(node)) {
        const refs = Array.isArray(v) ? v : [v];
        for (const r of refs) {
          if (r && typeof r === 'object' && Object.keys(r).length === 1 && r['@id']) {
            if (!ids.has(r['@id']) && !r['@id'].startsWith('https://zaiq.co.za')) {
              problems.push(`${t}.${k} dangling @id ref: ${r['@id']}`);
            }
          }
        }
      }
    }
  }

  // 2. Content audits on visible text
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ');
  const emDashes = (visible.match(/—/g) || []).length;
  if (emDashes > 0) problems.push(`${emDashes} em-dash(es) in visible text (house rule: 0)`);
  for (const tell of LLM_TELLS) {
    if (visible.toLowerCase().includes(tell.toLowerCase())) problems.push(`LLM-tell / placeholder: "${tell}"`);
  }

  // 3. AEO presence on guide pages
  const isGuide = rel.startsWith('guides');
  if (isGuide) {
    if (!html.includes('The short answer')) problems.push('missing AnswerBlock (BLUF)');
    if (!typesSeen.has('Article')) problems.push('guide missing Article schema');
    if (!typesSeen.has('BreadcrumbList')) problems.push('guide missing BreadcrumbList');
  }

  const status = problems.length === 0 ? 'PASS' : 'FAIL';
  if (problems.length) pass = false;
  console.log(`\n[${status}] ${rel}`);
  console.log(`   schema: ${[...typesSeen].join(', ') || 'none'}`);
  for (const p of problems) console.log(`   ! ${p}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(pass ? 'RESULT: PASS (0 blocking)\n' : 'RESULT: FAIL\n');
process.exit(pass ? 0 : 1);
