/**
 * CSV Import Utilities
 * 
 * Provides:
 * - Flexible header mapping
 * - Domain normalization for deduplication
 * - Company name normalization
 * - Import batch tracking
 */

import { sanitizeWebsiteUrl } from './url-sanitizer';

// ============================================================================
// HEADER MAPPING - Flexible mapping for various CSV formats
// ============================================================================

// Map of canonical field names to possible CSV header variations
const HEADER_MAPPINGS: Record<string, string[]> = {
  // Company/Business name
  companyName: [
    'place/name', 'name', 'business', 'company', 'company_name', 'companyname',
    'business_name', 'businessname', 'title', 'organization', 'org', 'firm',
    'Business Name', 'Company Name', 'Company', 'Business', 'Name', 'Title'
  ],
  // Phone
  phone: [
    'place/phone', 'phone', 'tel', 'telephone', 'mobile', 'contact', 'phone_number',
    'phonenumber', 'contact_number', 'phoneNumber', 'Phone', 'Telephone', 'Mobile', 'Contact'
  ],
  // Website
  website: [
    'place/website_url', 'website', 'url', 'web', 'site', 'website_url', 'web_url',
    'homepage', 'link', 'Website', 'URL', 'Web', 'Site', 'Homepage'
  ],
  // Email
  email: [
    'email', 'mail', 'e-mail', 'email_address', 'emailaddress', 'contact_email',
    'Email', 'Mail', 'E-mail', 'Email Address'
  ],
  // Address
  address: [
    'place/address', 'address', 'location', 'street', 'full_address', 'fulladdress',
    'street_address', 'Address', 'Location', 'Street', 'Full Address'
  ],
  // Category/Industry
  category: [
    'place/main_category', 'category', 'type', 'industry', 'service', 'sector',
    'business_type', 'Category', 'Type', 'Industry', 'Service', 'Sector'
  ],
  // Rating
  rating: [
    'place/ave_review_rating', 'rating', 'stars', 'score', 'average_rating',
    'review_rating', 'Rating', 'Stars', 'Score'
  ],
  // Review count
  reviewCount: [
    'place/review_count', 'reviews', 'review_count', 'reviewcount', 'num_reviews',
    'total_reviews', 'Reviews', 'Review Count', 'reviewCount'
  ],
  // Map URL / Place URL (Google Maps link)
  mapUrl: [
    'place/map_url', 'map_url', 'google_maps', 'maps_link', 'map_link',
    'placeUrl', 'place_url', 'google_map_url', 'googleMapsUrl',
    'Map URL', 'Google Maps', 'Maps Link', 'Place URL'
  ],
  // Description / Subtitle
  description: [
    'description', 'about', 'bio', 'summary', 'overview', 'details',
    'subtitle', 'Subtitle', 'Description', 'About', 'Bio', 'Summary'
  ],
  // Ranking (place/ranking)
  ranking: [
    'place/ranking', 'ranking', 'rank', 'position', 'Ranking', 'Rank', 'Position'
  ],
  // Market Share
  marketShare: [
    'market_share', 'marketshare', 'market', 'share', 'Market Share', 'MarketShare'
  ],
  // Average Position
  averagePosition: [
    'average_position', 'avg_position', 'avgposition', 'Average Position', 'Avg Position'
  ],
  // Photos Count
  photosCount: [
    'photos_count', 'photoscount', 'photos', 'photo_count', 'Photos Count', 'Photos'
  ],
  // Status
  status: [
    'status', 'state', 'lead_status', 'Status', 'State', 'Lead Status'
  ],
  // Search Query (for tracking which search produced this lead)
  searchQuery: [
    'searchQuery', 'search_query', 'query', 'search', 'keyword', 'keywords',
    'Search Query', 'Query', 'Search', 'Keyword'
  ],
};

/**
 * Find a field value from a CSV row using flexible header mapping
 */
export function findFieldValue(row: Record<string, string>, fieldName: string): string {
  const possibleHeaders = HEADER_MAPPINGS[fieldName] || [fieldName];
  
  // Try exact match first
  for (const header of possibleHeaders) {
    if (row[header] && row[header].trim()) {
      return row[header].trim();
    }
  }
  
  // Try case-insensitive partial match
  const rowKeys = Object.keys(row);
  for (const header of possibleHeaders) {
    const key = rowKeys.find(k => k.toLowerCase().includes(header.toLowerCase()));
    if (key && row[key] && row[key].trim()) {
      return row[key].trim();
    }
  }
  
  return '';
}

// ============================================================================
// DOMAIN NORMALIZATION - For company deduplication
// ============================================================================

/**
 * Normalize a domain for deduplication.
 * Strips www, protocol, trailing slashes, and converts to lowercase.
 */
export function normalizeDomain(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  
  // First sanitize the URL
  const sanitized = sanitizeWebsiteUrl(url);
  if (!sanitized) return null;
  
  try {
    const urlObj = new URL(sanitized);
    let domain = urlObj.hostname.toLowerCase();
    
    // Remove www. prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    return domain || null;
  } catch {
    // If URL parsing fails, try basic extraction
    let domain = url.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .trim();
    
    return domain || null;
  }
}

/**
 * Normalize a company name for deduplication.
 * Removes common suffixes, punctuation, and converts to lowercase.
 */
export function normalizeCompanyName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common business suffixes
    .replace(/\b(ltd|limited|llc|inc|incorporated|corp|corporation|plc|co|company|gmbh|pty|pvt)\b\.?/gi, '')
    // Remove punctuation
    .replace(/[^\w\s]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a deduplication key for a company.
 * Priority: normalized domain > normalized name
 */
export function getCompanyDedupeKey(
  name: string,
  website: string | undefined
): string {
  // Prefer domain-based deduplication
  if (website) {
    const domain = normalizeDomain(website);
    if (domain) {
      return `domain:${domain}`;
    }
  }
  
  // Fall back to name-based deduplication
  const normalizedName = normalizeCompanyName(name);
  if (normalizedName) {
    return `name:${normalizedName}`;
  }
  
  // Last resort: use raw name
  return `raw:${name}`;
}

// ============================================================================
// IMPORT BATCH TRACKING
// ============================================================================

/**
 * Generate a unique import batch ID
 */
export function generateImportBatchId(): string {
  return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// CSV PARSING
// ============================================================================

/**
 * Parse a CSV line respecting quoted fields
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse CSV text into headers and rows
 */
export function parseCSV(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  
  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  }).filter(row => Object.values(row).some(v => v.trim() !== ''));

  return { headers, rows };
}

// ============================================================================
// DATA EXTRACTION FROM CSV ROW
// ============================================================================

export interface ExtractedRowData {
  companyName: string;
  phone: string;
  website: string;
  email: string;
  address: string;
  category: string;
  rating: number | null;
  reviewCount: number;
  mapUrl: string;
  description: string;
  ranking: number | null;
  marketShare: number | null;
  averagePosition: number | null;
  photosCount: number;
  status: string;
  searchQuery: string;
  rawData: Record<string, string>;
  dedupeKey: string;
}

/**
 * Extract and normalize data from a CSV row
 */
export function extractRowData(row: Record<string, string>, index: number): ExtractedRowData {
  const companyName = findFieldValue(row, 'companyName') || `Business ${index + 1}`;
  const rawWebsite = findFieldValue(row, 'website');
  const website = sanitizeWebsiteUrl(rawWebsite) || '';
  const phone = findFieldValue(row, 'phone').replace(/[^\d+]/g, '');
  const email = findFieldValue(row, 'email');
  const address = findFieldValue(row, 'address');
  const category = findFieldValue(row, 'category') || 'Uncategorized';
  const ratingStr = findFieldValue(row, 'rating');
  const rating = ratingStr ? parseFloat(ratingStr) : null;
  const reviewCountStr = findFieldValue(row, 'reviewCount');
  const reviewCount = reviewCountStr ? parseInt(reviewCountStr, 10) : 0;
  const mapUrl = findFieldValue(row, 'mapUrl');
  const description = findFieldValue(row, 'description');
  
  // New fields for complete data mapping
  const rankingStr = findFieldValue(row, 'ranking');
  const ranking = rankingStr ? parseInt(rankingStr, 10) : null;
  const marketShareStr = findFieldValue(row, 'marketShare');
  const marketShare = marketShareStr ? parseFloat(marketShareStr) : null;
  const avgPosStr = findFieldValue(row, 'averagePosition');
  const averagePosition = avgPosStr ? parseFloat(avgPosStr) : null;
  const photosCountStr = findFieldValue(row, 'photosCount');
  const photosCount = photosCountStr ? parseInt(photosCountStr, 10) : 0;
  
  // Additional fields from Google Maps CSV exports
  const status = findFieldValue(row, 'status');
  const searchQuery = findFieldValue(row, 'searchQuery');
  
  const dedupeKey = getCompanyDedupeKey(companyName, website);
  
  return {
    companyName,
    phone,
    website,
    email,
    address,
    category,
    rating: isNaN(rating as number) ? null : rating,
    reviewCount: isNaN(reviewCount) ? 0 : reviewCount,
    mapUrl,
    description,
    ranking: isNaN(ranking as number) ? null : ranking,
    marketShare: isNaN(marketShare as number) ? null : marketShare,
    averagePosition: isNaN(averagePosition as number) ? null : averagePosition,
    photosCount: isNaN(photosCount) ? 0 : photosCount,
    status,
    searchQuery,
    rawData: row,
    dedupeKey,
  };
}
