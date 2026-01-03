/**
 * URL Sanitizer Utility
 * 
 * Cleans dirty website URLs from CSV imports, particularly:
 * - Google redirect URLs (/url?q=...)
 * - Junk text before/after URLs
 * - Tracking parameters (opi, sa, ved, usg, utm_*, fbclid, etc.)
 * - Missing protocols
 * - Invalid schemes
 */

// Common tracking/junk query parameters to strip
const TRACKING_PARAMS = new Set([
  'opi', 'sa', 'ved', 'usg', 'ei', 'bvm', 'cd', 'cad', 'rct', 'esrc', 'source',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'gclsrc', 'msclkid', 'dclid',
  'ref', 'referrer', 'mc_cid', 'mc_eid',
  '_ga', '_gl', '_hsenc', '_hsmi', 'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
  'srsltid', 'scid', 'aff', 'affiliate', 'partner',
]);

// Valid web protocols
const VALID_PROTOCOLS = ['http:', 'https:'];

// Regex to detect domain-like strings (for adding protocol)
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+/;

/**
 * Extract the `q` parameter value from a Google redirect URL.
 * Handles formats like:
 *   - /url?q=https://example.com/&opi=...
 *   - url?q=http://example.com
 */
function extractGoogleRedirectUrl(raw: string): string | null {
  // Match /url?q= or url?q= pattern
  const googlePattern = /(?:^|\/)url\?/i;
  if (!googlePattern.test(raw)) {
    return null;
  }
  
  // Try to extract q parameter
  try {
    // Find the q= part
    const qMatch = raw.match(/[?&]q=([^&\s]+)/i);
    if (qMatch && qMatch[1]) {
      // Decode and return
      return decodeURIComponent(qMatch[1]);
    }
  } catch {
    // Decoding failed, try another approach
  }
  
  return null;
}

/**
 * Extract the first valid http(s) URL from a string that may contain junk.
 */
function extractFirstHttpUrl(raw: string): string | null {
  // Find first http:// or https://
  const httpMatch = raw.match(/https?:\/\/[^\s"'<>]+/i);
  if (httpMatch) {
    return httpMatch[0];
  }
  return null;
}

/**
 * Clean control characters, quotes, and excess whitespace.
 */
function cleanControlChars(str: string): string {
  return str
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[""'']/g, '') // Remove curly quotes
    .replace(/["']/g, '') // Remove straight quotes
    .trim();
}

/**
 * Remove tracking parameters from a URL.
 */
function stripTrackingParams(url: URL): void {
  const keysToDelete: string[] = [];
  
  url.searchParams.forEach((_, key) => {
    const lowerKey = key.toLowerCase();
    if (TRACKING_PARAMS.has(lowerKey) || lowerKey.startsWith('utm_') || lowerKey.startsWith('hsa_')) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => url.searchParams.delete(key));
}

/**
 * Normalize the URL:
 * - Lowercase hostname
 * - Remove trailing slash (unless path has content after /)
 * - Remove default ports
 */
function normalizeUrl(url: URL): string {
  // Lowercase hostname
  url.hostname = url.hostname.toLowerCase();
  
  // Build the result
  let result = `${url.protocol}//${url.hostname}`;
  
  // Add port if non-standard
  if (url.port && url.port !== '80' && url.port !== '443') {
    result += `:${url.port}`;
  }
  
  // Add pathname (preserve case)
  let pathname = url.pathname;
  
  // Remove trailing slash unless it's just "/"
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  
  // Only add pathname if it's not just "/"
  if (pathname && pathname !== '/') {
    result += pathname;
  }
  
  // Add search params if any remain after stripping trackers
  if (url.search && url.search !== '?') {
    result += url.search;
  }
  
  // Add hash if present
  if (url.hash) {
    result += url.hash;
  }
  
  return result;
}

/**
 * Attempt to prepend protocol to a domain-like string.
 */
function addProtocolIfMissing(str: string): string {
  const cleaned = str.trim();
  
  // Already has protocol
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  
  // Remove any leading slashes or "www." prefix for detection
  const stripped = cleaned.replace(/^\/+/, '');
  
  // Check if it looks like a domain
  if (DOMAIN_REGEX.test(stripped)) {
    return `https://${stripped}`;
  }
  
  return cleaned;
}

/**
 * Main sanitization function.
 * 
 * @param raw - The raw, potentially dirty URL string
 * @returns Clean canonical URL or null if invalid/not extractable
 * 
 * @example
 * sanitizeWebsiteUrl('/url?q=http://example.com/&opi=123&ved=456')
 * // => 'http://example.com'
 * 
 * sanitizeWebsiteUrl('9E+11 /url?q=http://www.site.co.uk/&opi=...')
 * // => 'http://www.site.co.uk'
 * 
 * sanitizeWebsiteUrl('example.com')
 * // => 'https://example.com'
 */
export function sanitizeWebsiteUrl(raw: string | null | undefined): string | null {
  // Handle null/undefined/empty
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  
  // Step 1: Clean control characters and trim
  let working = cleanControlChars(raw);
  
  if (!working) {
    return null;
  }
  
  // Step 2: Check for Google redirect URL pattern
  const googleExtracted = extractGoogleRedirectUrl(working);
  if (googleExtracted) {
    working = cleanControlChars(googleExtracted);
  }
  
  // Step 3: If there's junk before a URL, extract the first http(s) URL
  const httpExtracted = extractFirstHttpUrl(working);
  if (httpExtracted) {
    working = httpExtracted;
  } else {
    // No http URL found - maybe it's a bare domain
    // Try to find domain-like text
    const parts = working.split(/\s+/);
    for (const part of parts) {
      const cleaned = part.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9./:-]+$/, '');
      if (DOMAIN_REGEX.test(cleaned) || /^https?:\/\//i.test(cleaned)) {
        working = cleaned;
        break;
      }
    }
  }
  
  // Step 4: Add protocol if missing
  working = addProtocolIfMissing(working);
  
  // Step 5: Try to parse as URL
  let url: URL;
  try {
    url = new URL(working);
  } catch {
    // Invalid URL even after cleanup
    return null;
  }
  
  // Step 6: Validate protocol (reject mailto:, javascript:, tel:, etc.)
  if (!VALID_PROTOCOLS.includes(url.protocol)) {
    return null;
  }
  
  // Step 7: Validate hostname exists
  if (!url.hostname || url.hostname.length < 3) {
    return null;
  }
  
  // Step 8: Strip tracking parameters
  stripTrackingParams(url);
  
  // Step 9: Normalize and return
  return normalizeUrl(url);
}

/**
 * Batch sanitize URLs across all records.
 * Useful for cleaning existing data.
 * 
 * @param records - Array of objects with a website property
 * @param websiteKey - The key containing the website URL (default: 'website')
 * @returns Object with counts of cleaned, failed, unchanged
 */
export function batchSanitizeUrls<T extends Record<string, any>>(
  records: T[],
  websiteKey: string = 'website'
): { 
  cleaned: number; 
  failed: number; 
  unchanged: number;
  results: T[];
} {
  let cleaned = 0;
  let failed = 0;
  let unchanged = 0;
  
  const results = records.map(record => {
    const original = record[websiteKey];
    
    if (!original) {
      unchanged++;
      return record;
    }
    
    const sanitized = sanitizeWebsiteUrl(original);
    
    if (sanitized === null) {
      failed++;
      return { ...record, [websiteKey]: '' }; // Clear invalid URLs
    }
    
    if (sanitized === original) {
      unchanged++;
      return record;
    }
    
    cleaned++;
    return { ...record, [websiteKey]: sanitized };
  });
  
  return { cleaned, failed, unchanged, results };
}

export default sanitizeWebsiteUrl;
