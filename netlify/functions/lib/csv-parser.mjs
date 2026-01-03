/**
 * CSV Parsing utility
 * Robust CSV parser that handles:
 * - Quoted fields with commas inside
 * - Escaped quotes
 * - Various line endings (CRLF, LF, CR)
 * - Empty fields
 */

/**
 * Parse CSV text into array of objects
 * @param {string} csvText - Raw CSV text
 * @returns {{ headers: string[], rows: object[], rawRows: string[][] }}
 */
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return { headers: [], rows: [], rawRows: [] };
  }

  // Normalize line endings
  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split into lines, handling quoted fields that may contain newlines
  const rawRows = parseCSVLines(normalized);
  
  if (rawRows.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  // First row is headers
  const headers = rawRows[0].map(h => h.trim());
  
  // Convert remaining rows to objects
  const rows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0 || (row.length === 1 && row[0].trim() === '')) {
      continue; // Skip empty rows
    }
    
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = j < row.length ? row[j].trim() : '';
      if (header) {
        obj[header] = value;
      }
    }
    rows.push(obj);
  }

  return { headers, rows, rawRows: rawRows.slice(1) };
}

/**
 * Parse CSV text into array of arrays (each row is array of fields)
 * Handles quoted fields correctly
 */
function parseCSVLines(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        i++;
      } else if (char === ',') {
        // End of field
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\n') {
        // End of row
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Don't forget the last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Normalize company name for duplicate detection
 * @param {string} name - Company name
 * @returns {string} Normalized name
 */
export function normalizeCompanyName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .replace(/\b(ltd|llc|inc|corp|limited|company|co)\b/gi, '') // Remove common suffixes
    .trim();
}

/**
 * Map CSV column names to database fields
 * Returns the known fields and any extra columns for meta
 */
export function mapCSVRowToFields(row, headers) {
  // Define known column mappings (CSV column -> DB field)
  const columnMappings = {
    // Company name variations
    'place/name': 'name',
    'company_name': 'name',
    'company': 'name',
    'name': 'name',
    'business_name': 'name',
    
    // Website variations
    'place/website_url': 'website',
    'website': 'website',
    'website_url': 'website',
    'url': 'website',
    'site': 'website',
    
    // Phone variations
    'place/phone': 'phone',
    'phone': 'phone',
    'phone_number': 'phone',
    'telephone': 'phone',
    'tel': 'phone',
    
    // Address variations
    'place/address': 'address',
    'address': 'address',
    'location': 'address',
    'full_address': 'address',
    
    // Ranking variations
    'place/ranking': 'ranking',
    'ranking': 'ranking',
    'rank': 'ranking',
    'position': 'ranking',
    'average_position': 'ranking',
    
    // Market variations
    'market': 'market',
    'market_share': 'market',
    'area': 'market',
    'region': 'market',
    
    // Review count
    'place/review_count': 'review_count',
    'review_count': 'review_count',
    'reviews': 'review_count',
    'num_reviews': 'review_count',
    
    // Review rating
    'place/ave_review_rating': 'review_rating',
    'review_rating': 'review_rating',
    'rating': 'review_rating',
    'average_rating': 'review_rating',
    'ave_review_rating': 'review_rating',
    
    // Category
    'place/main_category': 'main_category',
    'main_category': 'main_category',
    'category': 'main_category',
    'industry': 'main_category',
    'type': 'main_category',
  };

  const knownFields = {};
  const meta = {};

  for (const [csvCol, value] of Object.entries(row)) {
    const normalizedCol = csvCol.toLowerCase().trim();
    const dbField = columnMappings[normalizedCol];
    
    if (dbField) {
      // Store in known fields
      knownFields[dbField] = value;
    } else if (value && value.trim()) {
      // Store in meta
      meta[csvCol] = value;
    }
  }

  return { knownFields, meta };
}

/**
 * Clean and validate a URL
 */
export function cleanWebsiteUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  let cleaned = url.trim();
  
  // Handle Google redirect URLs
  if (cleaned.includes('/url?q=')) {
    const match = cleaned.match(/\/url\?q=([^&]+)/);
    if (match) {
      cleaned = decodeURIComponent(match[1]);
    }
  }
  
  // Remove leading slashes
  cleaned = cleaned.replace(/^\/+/, '');
  
  // Add https if no protocol
  if (cleaned && !cleaned.match(/^https?:\/\//i)) {
    cleaned = 'https://' + cleaned;
  }
  
  // Validate URL format
  try {
    new URL(cleaned);
    return cleaned;
  } catch {
    return null;
  }
}

/**
 * Parse numeric value, return null if invalid
 */
export function parseNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * Parse integer value, return null if invalid
 */
export function parseInt(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number.parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
  return isNaN(num) ? null : num;
}

export default {
  parseCSV,
  normalizeCompanyName,
  mapCSVRowToFields,
  cleanWebsiteUrl,
  parseNumeric,
  parseInt
};
