import { SITE_META } from './config'

export function getWebsiteStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: SITE_META.url,
    name: SITE_META.name,
    description: SITE_META.description,
    inLanguage: 'en-US',
  }
}

export function getWebPageStructuredData(path: string, title: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: `${SITE_META.url}${path.startsWith('/') ? path : `/${path}`}`,
    name: title,
    description,
    inLanguage: 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      '@id': SITE_META.url,
    },
  }
}
