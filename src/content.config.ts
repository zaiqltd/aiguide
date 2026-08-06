import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Guides: the answer pages. Structured AEO fields live in frontmatter so the layout can
// render BOTH the visible blocks and the JSON-LD from a single source of truth.
const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // The BLUF: a complete, self-contained, liftable answer in 40-60 words. The thing AI quotes.
    answer: z.string(),
    cluster: z.enum(['costs', 'ai-business', 'build', 'frontier', 'research']),
    clusterLabel: z.string(),
    clusterPath: z.string().optional(),
    author: z.string(), // author slug, e.g. 'chad-alexander'
    datePublished: z.string(),
    dateModified: z.string().optional(),
    lastVerified: z.string().optional(),
    intent: z
      .enum(['informational', 'commercial', 'transactional'])
      .default('informational'),
    isHub: z.boolean().default(false),
    // AEO structured blocks (rendered visibly AND as schema):
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    howto: z
      .object({
        name: z.string(),
        description: z.string().optional(),
        steps: z.array(z.object({ name: z.string(), text: z.string() })),
      })
      .optional(),
    keywords: z.array(z.string()).default([]),
    image: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// Authors: real, named, credentialed engineers. The E-E-A-T + entity layer.
const authors = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    jobTitle: z.string(),
    credential: z.string().optional(), // field of study, current
    affiliation: z.string().optional(), // current educational org
    award: z.string().optional(),
    knowsAbout: z.array(z.string()).default([]),
    short: z.string(), // one-line byline descriptor
    image: z.string().optional(),
    // Grounded public profiles only; empty is omitted from schema, never fabricated.
    sameAs: z.array(z.string()).default([]),
  }),
});

export const collections = { guides, authors };
