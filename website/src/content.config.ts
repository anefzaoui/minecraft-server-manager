import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // Overrides for Starlight's own UI strings (search, "On this page", ...), one
  // JSON per locale under src/content/i18n/. Empty is fine: Starlight ships
  // translations for most of our locales and falls back to English otherwise.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
