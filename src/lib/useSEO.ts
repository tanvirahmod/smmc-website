import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_NAME = 'Sufia Motin Mohila College';
export const SITE_URL = 'https://sufiamotinmohilacollege.edu.bd';

interface SEOOptions {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  noindex?: boolean;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function useSEO({ title, description, path, image, type = 'website', noindex = false }: SEOOptions) {
  const location = useLocation();
  const currentPath = path ?? location.pathname;

  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;

    const robots = noindex ? 'noindex, nofollow' : 'index, follow';
    const ogImage = image || `${SITE_URL}/og-cover.svg`;

    setMeta('name', 'description', description);
    setMeta('name', 'robots', robots);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', `${SITE_URL}${currentPath}`);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:image', ogImage);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', ogImage);
    setLink('canonical', `${SITE_URL}${currentPath}`);
  }, [title, description, currentPath, image, type, noindex]);
}
