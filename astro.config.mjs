// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://aiguide.co.za',
  // 'ignore' = lenient routing (both /foo and /foo/ resolve, so the no-trailing-slash internal
  // links never 404). Canonical + OG are normalised to trailing-slash in Base.astro to match the
  // sitemap, so SEO sees one URL per page regardless.
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    sitemap({
      changefreq: 'weekly',
      lastmod: new Date(),
    }),
  ],
  build: { format: 'directory' },
});
