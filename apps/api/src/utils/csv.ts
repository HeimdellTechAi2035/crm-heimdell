/**
 * CSV Parsing Utility
 * Handles CSV parsing with support for different delimiters, quoted values, and data normalization
 */

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export interface CsvParseOptions {
  delimiter?: ',' | ';' | '\t';
  skipEmptyLines?: boolean;
  trimValues?: boolean;
  maxPreviewRows?: number;
}

/**
 * Parse CSV content into structured data
 */
export function parseCSV(content: string, options: CsvParseOptions = {}): CsvParseResult {
  const {
    delimiter = ',',
    skipEmptyLines = true,
    trimValues = true,
    maxPreviewRows,
  } = options;

  const lines = content.split('\n');
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse headers
  const headerLine = lines[0];
  const headers = parseLine(headerLine, delimiter, trimValues);

  if (headers.length === 0) {
    throw new Error('CSV file has no headers');
  }

  // Parse rows
  const rows: Record<string, string>[] = [];
  const limit = maxPreviewRows ? Math.min(lines.length, maxPreviewRows + 1) : lines.length;

  for (let i = 1; i < limit; i++) {
    const line = lines[i];

    if (skipEmptyLines && !line.trim()) {
      continue;
    }

    const values = parseLine(line, delimiter, trimValues);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    rows.push(row);
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
}

/**
 * Parse a single CSV line, handling quoted values properly
 */
function parseLine(line: string, delimiter: string, trim: boolean): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentValue += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of value
      values.push(trim ? currentValue.trim() : currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Add final value
  values.push(trim ? currentValue.trim() : currentValue);

  return values;
}

/**
 * Auto-detect delimiter from CSV content
 */
export function detectDelimiter(content: string): ',' | ';' | '\t' {
  const firstLine = content.split('\n')[0];

  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > 0 && tabCount >= commaCount && tabCount >= semicolonCount) {
    return '\t';
  }

  if (semicolonCount > commaCount) {
    return ';';
  }

  return ',';
}

/**
 * Normalize phone number to E.164 format (simple UK implementation)
 */
export function normalizePhone(phone: string): { raw: string; normalized: string | null } {
  const raw = phone.trim();

  // Remove all non-digit characters except +
  let cleaned = raw.replace(/[^\d+]/g, '');

  // If it starts with 0 and is 11 digits, assume UK number
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '+44' + cleaned.substring(1);
  }

  // If it's just digits and 10-11 long, assume UK without prefix
  if (/^\d{10,11}$/.test(cleaned)) {
    if (cleaned.length === 10) {
      cleaned = '+44' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = '+44' + cleaned.substring(1);
    }
  }

  // Validate E.164 format (+ followed by 1-15 digits)
  if (/^\+\d{1,15}$/.test(cleaned)) {
    return { raw, normalized: cleaned };
  }

  return { raw, normalized: null };
}

/**
 * Extract domain from website URL or email
 */
export function extractDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  // Check if it's an email
  const emailMatch = trimmed.match(/@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (emailMatch) {
    return emailMatch[1];
  }

  // Check if it's a URL
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    // Not a valid URL
  }

  // Check if it looks like a domain
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) {
    return trimmed.replace(/^www\./, '');
  }

  return null;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Normalize company name (remove common suffixes for matching)
 */
export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+(ltd|limited|llc|inc|corp|corporation|plc|gmbh|sa|srl)\.?$/i, '')
    .trim();
}

/**
 * Generate unique key for lead de-duplication
 */
export function generateLeadKey(data: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}): string[] {
  const keys: string[] = [];

  // Email is primary key
  if (data.email && isValidEmail(data.email)) {
    keys.push(`email:${data.email.toLowerCase().trim()}`);
  }

  // Normalized phone is secondary key
  if (data.phone) {
    const { normalized } = normalizePhone(data.phone);
    if (normalized) {
      keys.push(`phone:${normalized}`);
    }
  }

  // Name + company combination
  if (data.firstName && data.lastName && data.companyName) {
    const key = `name:${data.firstName.toLowerCase().trim()}:${data.lastName.toLowerCase().trim()}:${normalizeCompanyName(data.companyName)}`;
    keys.push(key);
  }

  return keys;
}

/**
 * Generate unique key for company de-duplication
 */
export function generateCompanyKey(data: {
  name?: string;
  domain?: string;
  website?: string;
  location?: string;
}): string[] {
  const keys: string[] = [];

  // Domain is primary key
  const domain = data.domain || (data.website ? extractDomain(data.website) : null);
  if (domain) {
    keys.push(`domain:${domain}`);
  }

  // Name + location combination
  if (data.name) {
    const normalizedName = normalizeCompanyName(data.name);
    if (data.location) {
      keys.push(`name-location:${normalizedName}:${data.location.toLowerCase().trim()}`);
    } else {
      keys.push(`name:${normalizedName}`);
    }
  }

  return keys;
}

/**
 * Validate CSV file size and type
 */
export function validateCsvFile(file: {
  filename: string;
  size: number;
  mimetype?: string;
}): { valid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_EXTENSIONS = ['.csv', '.txt'];
  const ALLOWED_MIMETYPES = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];

  // Check size
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check extension
  const ext = file.filename.toLowerCase().slice(file.filename.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file type. Only CSV files are allowed.`,
    };
  }

  // Check mimetype if provided
  if (file.mimetype && !ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid file content type: ${file.mimetype}`,
    };
  }

  return { valid: true };
}

