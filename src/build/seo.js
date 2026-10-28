// Search and link-preview metadata: head tags, structured data, robots.txt and sitemap.
// Only facts that are visible on the page go into the structured data.

const NAME = 'Tomáš Sezima';
const PLAIN_NAME = 'Tomas Sezima';
const CLAIM = 'I build the data platforms that products and AI agents run on.';
const DESCRIPTION = 'Tomáš Sezima builds the data platforms that products and AI agents run on. Head of Data Engineering at Datamole in Brno, working with AWS, Databricks and agentic AI.';
const LINKEDIN = 'https://www.linkedin.com/in/sezima';
const GROUPS = [
  { name: 'AWS User Group Brno', url: 'https://www.meetup.com/brno-aws-user-group/' },
  { name: 'Databricks User Group Brno', url: 'https://www.meetup.com/databricks-brno-user-group/' },
];
const OG_IMAGE = { file: 'og-image.png', width: 1200, height: 630, alt: 'Tomáš Sezima. I build the data platforms that products and AI agents run on.' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The site address must be absolute https and end with exactly one slash.
export function normalizeSiteUrl(url) {
  if (typeof url !== 'string' || !/^https:\/\/[^/\s]+/.test(url)) throw new Error(`site address must start with https://, got "${url}"`);
  return url.replace(/\/+$/, '') + '/';
}

export function structuredData(siteUrl, today) {
  const id = part => `${siteUrl}#${part}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': id('website'), url: siteUrl, name: NAME, alternateName: PLAIN_NAME },
      {
        // Google wants a full date and time here, so the build date gets midnight UTC.
        '@type': 'ProfilePage', '@id': id('profile'), url: siteUrl, name: NAME, dateModified: `${today}T00:00:00Z`,
        isPartOf: { '@id': id('website') }, mainEntity: { '@id': id('person') },
      },
      {
        '@type': 'Person', '@id': id('person'), name: NAME, alternateName: PLAIN_NAME,
        givenName: 'Tomáš', familyName: 'Sezima', url: siteUrl, description: CLAIM,
        jobTitle: 'Head of Data Engineering',
        worksFor: { '@type': 'Organization', name: 'Datamole' },
        homeLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Brno', addressCountry: 'CZ' } },
        knowsAbout: ['Data engineering', 'Data platforms', 'Amazon Web Services', 'Databricks', 'Generative AI', 'Agentic AI'],
        memberOf: GROUPS.map(g => ({ '@type': 'Organization', name: g.name, url: g.url })),
        sameAs: [LINKEDIN],
      },
    ],
  };
}

export function renderHead({ siteUrl, today }) {
  const image = siteUrl + OG_IMAGE.file;
  const meta = (attr, key, value) => `<meta ${attr}="${key}" content="${esc(value)}">`;
  return [
    `<meta name="description" content="${esc(DESCRIPTION)}">`,
    `<link rel="canonical" href="${esc(siteUrl)}">`,
    '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="favicon-192.png" sizes="192x192" type="image/png">',
    '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
    // The same page as Markdown, for AI agents (see agents.js).
    '<link rel="alternate" type="text/markdown" href="index.html.md">',
    meta('property', 'og:type', 'profile'),
    meta('property', 'profile:first_name', 'Tomáš'),
    meta('property', 'profile:last_name', 'Sezima'),
    meta('property', 'og:site_name', NAME),
    meta('property', 'og:locale', 'en_US'),
    meta('property', 'og:title', `${NAME}: data platforms for products and AI agents`),
    meta('property', 'og:description', DESCRIPTION),
    meta('property', 'og:url', siteUrl),
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', OG_IMAGE.width),
    meta('property', 'og:image:height', OG_IMAGE.height),
    meta('property', 'og:image:alt', OG_IMAGE.alt),
    meta('name', 'twitter:card', 'summary_large_image'),
    // "<" is escaped so the JSON can never close the script element.
    `<script type="application/ld+json">${JSON.stringify(structuredData(siteUrl, today)).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}

export function renderRobots(siteUrl) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`;
}

export function renderSitemap(siteUrl, today) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${esc(siteUrl)}</loc>
    <lastmod>${today}</lastmod>
  </url>
</urlset>
`;
}
