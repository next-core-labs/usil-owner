/**
 * The vendor console (vendor.usil.app) opened for one vendor: an admin or
 * accounts manager signs in there with their own account and acts for that
 * vendor (`?vendorId=`). Local dev runs the console on 5190.
 */
export function vendorConsoleUrl(vendorId?: string): string {
  const host = typeof location === 'undefined' ? '' : location.hostname;
  const base = host === '127.0.0.1' || host === 'localhost' ? 'http://127.0.0.1:5190' : 'https://vendor.usil.app';
  return vendorId ? `${base}/?vendorId=${encodeURIComponent(vendorId)}` : base;
}
