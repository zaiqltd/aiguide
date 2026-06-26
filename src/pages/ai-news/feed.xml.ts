import type { APIRoute } from 'astro';
import { SITE } from '../../lib/site';

// Hand-rolled RSS 2.0 (no @astrojs/rss dependency, so it cannot break the build). One
// <item> per daily brief. Lets readers and some AI crawlers subscribe to the morning brief.
const modules = import.meta.glob('../../data/ai-news/*.json', { eager: true });
const briefs = Object.values(modules)
  .map((m: any) => m.default)
  .sort((a: any, b: any) => b.date.localeCompare(a.date))
  .slice(0, 30);

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const pubDate = (b: any) => new Date(b.generatedAt || `${b.date}T06:00:00+02:00`).toUTCString();

export const GET: APIRoute = () => {
  const items = briefs
    .map((b: any) => {
      const link = `${SITE.url}/ai-news/${b.date}`;
      const body = [
        b.summary,
        ...(b.items || []).map(
          (it: any) => `${it.headline}: ${it.what}${it.soWhat ? ' For a South African business: ' + it.soWhat : ''}`
        ),
      ]
        .filter(Boolean)
        .join('\n\n');
      return `    <item>
      <title>${esc(b.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${pubDate(b)}</pubDate>
      <description>${esc(body)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Guide: the daily AI brief for South African business</title>
    <link>${SITE.url}/ai-news</link>
    <atom:link href="${SITE.url}/ai-news/feed.xml" rel="self" type="application/rss+xml" />
    <description>The AI developments that matter, each linked to its source and read through one lens: what it means for a business operating in South Africa. Updated every morning.</description>
    <language>en-za</language>
    <lastBuildDate>${briefs[0] ? pubDate(briefs[0]) : new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
