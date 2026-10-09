import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

const codeTheme = JSON.parse(
  readFileSync(new URL('./src/styles/shiki-theme.json', import.meta.url), 'utf8')
);

export default defineConfig({
  site: 'https://4ak5ra.github.io',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: codeTheme,
      wrap: false,
    },
  },
});
