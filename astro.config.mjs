// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://aiguide.co.za',
  // 'ignore' = lenient routing (both /foo and /foo/ resolve). Vercel (trailingSlash:false) serves
  // /foo as 200 and 308-redirects /foo/, so the canonical convention is NO trailing slash — set in
  // Base.astro, matched by the sitemap serialize below + the schema @id URLs. One URL per page.
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    sitemap({
      changefreq: 'weekly',
      lastmod: new Date(),
      // Strip trailing slashes so sitemap URLs are the 200 (no-redirect) canonical URLs.
      serialize(item) {
        if (item.url !== 'https://aiguide.co.za/') {
          item.url = item.url.replace(/\/$/, '');
        }
        return item;
      },
    }),
  ],
  build: { format: 'directory' },
});
