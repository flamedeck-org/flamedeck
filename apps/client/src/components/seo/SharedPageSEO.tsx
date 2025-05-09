import { memo } from 'react';
import { Helmet } from 'react-helmet-async';

interface SharedPageSEOProps {
  pageTitle: string; // The specific title of the current page (e.g., "Login", "API Keys")
  description: string;
  path: string; // The specific path for the page (e.g., "/login", "/docs/api-keys")
  ogType?: 'website' | 'article'; // Defaults to 'website'
  titleSuffix?: string | null; // e.g., "- Flamedeck Docs". Pass null for no suffix, defaults to "- Flamedeck"
}

const BASE_URL = 'https://www.flamedeck.com'; // TODO: Consider making this an environment variable
const SITE_NAME = 'Flamedeck';
const DEFAULT_TITLE_SUFFIX = ` - ${SITE_NAME}`;
const TWITTER_SITE_HANDLE = '@flamedeckapp'; // TODO: Confirm this handle and consider making it a constant if used elsewhere

function SharedPageSEO({
  pageTitle,
  description,
  path,
  ogType = 'website',
  titleSuffix = DEFAULT_TITLE_SUFFIX,
}: SharedPageSEOProps) {
  const fullTitle = titleSuffix ? `${pageTitle}${titleSuffix}` : pageTitle;
  const canonicalUrl = `${BASE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      {/* TODO: Add a default og:image based on page type or a general one */}
      {/* e.g., <meta property="og:image" content={`${BASE_URL}/default-og-image.png`} /> */}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_SITE_HANDLE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {/* TODO: Add a default twitter:image, often same as og:image */}
      {/* <meta name="twitter:image" content={`${BASE_URL}/default-twitter-image.png`} /> */}
    </Helmet>
  );
}

export default memo(SharedPageSEO);
