import type { MetadataRoute } from 'next';

const BASE = 'https://yumoii789.github.io/Gaokao-Academic-Resources';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/standard', '/spring', '/vocab'].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: p === '' ? 1 : 0.8,
  }));
}