import type { MetadataRoute } from 'next'
import { SITE_META } from '@/lib/seo/config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/room/', '/debug/'],
      },
    ],
    sitemap: `${SITE_META.url}/sitemap.xml`,
  }
}
