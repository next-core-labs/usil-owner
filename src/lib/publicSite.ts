/// <reference types="vite/client" />

/** Where the storefront lives when nothing more specific is known. */
const PRODUCTION_SITE = 'https://usil.app';

/**
 * The public storefront's origin, for links that must leave the console
 * (sitemap, robots). A relative `/sitemap.xml` would open this app instead.
 *
 * `VITE_PUBLIC_SITE_URL` wins when set. Otherwise owner.<site> maps to <site>,
 * and local dev points at the storefront on :3000 of the same host.
 */
export function publicSiteUrl(): string {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return `${protocol}//${hostname}:3000`;
  }
  if (hostname.startsWith('owner.')) return `${protocol}//${hostname.slice('owner.'.length)}`;
  return PRODUCTION_SITE;
}
