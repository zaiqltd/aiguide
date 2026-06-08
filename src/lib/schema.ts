// JSON-LD @graph builders. Schema-first, refuse-to-fabricate (skills/schema-first-author.md:77-83):
// every builder drops fields it cannot ground rather than inventing them.

import { SITE, ZAIQ } from './site';

type Json = Record<string, any>;

/** Recursively remove undefined, null, '', [], and {} so we never emit empty schema fields. */
export function clean<T extends Json>(obj: T): T {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      const arr = v
        .map((x) => (x && typeof x === 'object' && !Array.isArray(x) ? clean(x) : x))
        .filter((x) => x !== undefined && x !== null && x !== '');
      if (arr.length) out[k] = arr;
    } else if (typeof v === 'object') {
      const c = clean(v);
      if (Object.keys(c).length) out[k] = c;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

const abs = (path: string) => new URL(path, SITE.url).href.replace(/\/$/, '');

// ---- Stable node identities ------------------------------------------------
export const WEBSITE_ID = `${SITE.url}/#website`;
export const ORG_ID = ZAIQ.id; // publisher = the established Zaiq Organization entity

// ---- Reusable nodes --------------------------------------------------------

export function websiteNode(): Json {
  return clean({
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    inLanguage: SITE.lang,
    publisher: { '@id': ORG_ID },
  });
}

export function organizationNode(): Json {
  return clean({
    '@type': 'Organization',
    '@id': ORG_ID,
    name: ZAIQ.name,
    url: ZAIQ.url,
    description: ZAIQ.description,
    slogan: ZAIQ.slogan,
    knowsAbout: [...ZAIQ.knowsAbout],
    areaServed: { '@type': 'Country', name: 'South Africa' },
    founder: ZAIQ.founders.map((name) => ({ '@type': 'Person', name })),
    sameAs: ZAIQ.sameAs,
  });
}

export interface AuthorInput {
  id: string; // slug, e.g. 'chad-etkind'
  name: string;
  jobTitle?: string;
  description?: string;
  affiliation?: string; // current educational org (they are students, not alumni)
  award?: string;
  knowsAbout?: string[];
  image?: string;
  sameAs?: string[];
}

export function personNode(a: AuthorInput): Json {
  return clean({
    '@type': 'Person',
    '@id': `${abs(`/authors/${a.id}`)}#person`,
    name: a.name,
    url: abs(`/authors/${a.id}`),
    jobTitle: a.jobTitle,
    description: a.description,
    image: a.image,
    worksFor: { '@id': ORG_ID },
    affiliation: a.affiliation
      ? { '@type': 'EducationalOrganization', name: a.affiliation }
      : undefined,
    award: a.award,
    knowsAbout: a.knowsAbout && a.knowsAbout.length ? a.knowsAbout : undefined,
    sameAs: a.sameAs && a.sameAs.length ? a.sameAs : undefined,
  });
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbNode(pagePath: string, crumbs: Crumb[]): Json {
  return clean({
    '@type': 'BreadcrumbList',
    '@id': `${abs(pagePath)}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  });
}

export interface ArticleInput {
  path: string;
  title: string;
  description: string;
  authorId: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  section?: string;
  keywords?: string[];
}

export function webPageNode(a: ArticleInput): Json {
  const url = abs(a.path);
  return clean({
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: a.title,
    description: a.description,
    isPartOf: { '@id': WEBSITE_ID },
    inLanguage: SITE.lang,
    breadcrumb: { '@id': `${url}#breadcrumb` },
    primaryImageOfPage: a.image ? { '@type': 'ImageObject', url: a.image } : undefined,
    datePublished: a.datePublished,
    dateModified: a.dateModified || a.datePublished,
  });
}

export function articleNode(a: ArticleInput): Json {
  const url = abs(a.path);
  return clean({
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: a.title,
    description: a.description,
    image: a.image,
    inLanguage: SITE.lang,
    datePublished: a.datePublished,
    dateModified: a.dateModified || a.datePublished,
    author: { '@id': `${abs(`/authors/${a.authorId}`)}#person` },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: { '@id': `${url}#webpage` },
    isPartOf: { '@id': WEBSITE_ID },
    articleSection: a.section,
    keywords: a.keywords && a.keywords.length ? a.keywords.join(', ') : undefined,
  });
}

export interface Faq {
  q: string;
  a: string;
}

export function faqPageNode(path: string, faqs: Faq[]): Json | null {
  if (!faqs || !faqs.length) return null;
  return clean({
    '@type': 'FAQPage',
    '@id': `${abs(path)}#faq`,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });
}

export interface HowToStep {
  name: string;
  text: string;
}

export function howToNode(
  path: string,
  howto: { name: string; description?: string; steps: HowToStep[] } | undefined
): Json | null {
  if (!howto || !howto.steps?.length) return null;
  return clean({
    '@type': 'HowTo',
    '@id': `${abs(path)}#howto`,
    name: howto.name,
    description: howto.description,
    step: howto.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  });
}

export interface ListChild {
  name: string;
  path: string;
}

export function itemListNode(path: string, children: ListChild[]): Json | null {
  if (!children || !children.length) return null;
  return clean({
    '@type': 'ItemList',
    '@id': `${abs(path)}#itemlist`,
    itemListElement: children.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      url: abs(c.path),
    })),
  });
}

export interface WebAppInput {
  path: string;
  name: string;
  description: string;
}

export function webApplicationNode(a: WebAppInput): Json {
  const url = abs(a.path);
  return clean({
    '@type': 'WebApplication',
    '@id': `${url}#app`,
    name: a.name,
    url,
    description: a.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript',
    inLanguage: SITE.lang,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORG_ID },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'ZAR' },
  });
}

/** Compose a final @graph, dropping nulls. */
export function graph(...nodes: (Json | null)[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  });
}
