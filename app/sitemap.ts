import type { MetadataRoute } from 'next'
import { SITE_META } from '@/lib/seo/config'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_META.url,
      lastModified: new Date(),
    },
  ]
}
