import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CSVRow {
  'market_share': string;
  'average_position': string;
  'place/map_url': string;
  'place/name': string;
  'place/address': string;
  'place/phone': string;
  'place/website_url': string;
  'place/review_count': string;
  'place/ave_review_rating': string;
  'place/ranking': string;
  'place/main_category': string;
  'photos_count': string;
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
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

function cleanPhone(phone: string): string {
  if (!phone) return '';
  // Remove URL prefixes and clean up
  let cleaned = phone.replace(/^\/url\?q=/, '').replace(/&.*$/, '');
  // Add + for UK numbers if missing
  if (cleaned.match(/^44\d+$/) || cleaned.match(/^07\d+$/)) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

function cleanWebsite(url: string): string {
  if (!url) return '';
  // Remove Google redirect wrapper
  let cleaned = url.replace(/^\/url\?q=/, '').replace(/&.*$/, '');
  // Decode URL
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch (e) {}
  return cleaned;
}

async function importCSV(filePath: string, category: string) {
  console.log(`\nImporting ${category} from ${filePath}...`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);
  
  console.log(`Found ${rows.length} rows`);
  
  // Get org and user
  const org = await prisma.organization.findFirst();
  const user = await prisma.user.findFirst();
  
  if (!org || !user) {
    console.error('No organization or user found. Run seed first.');
    return;
  }
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    const name = row['place/name']?.trim();
    if (!name) {
      skipped++;
      continue;
    }
    
    const phone = cleanPhone(row['place/phone'] || '');
    const website = cleanWebsite(row['place/website_url'] || '');
    const address = row['place/address'] || '';
    const reviewCount = parseInt(row['place/review_count'] || '0') || 0;
    const rating = parseFloat(row['place/ave_review_rating'] || '0') || 0;
    const marketShare = parseFloat(row['market_share'] || '0') || 0;
    const avgPosition = parseFloat(row['average_position'] || '0') || 0;
    const mapUrl = row['place/map_url'] || '';
    const mainCategory = row['place/main_category'] || category;
    
    // Create as Company
    const company = await prisma.company.create({
      data: {
        name,
        phone: phone || null,
        website: website || null,
        location: address || null,
        industry: mainCategory || category,
        organizationId: org.id,
        ownerId: user.id,
        profileJson: {
          source: 'csv_import',
          category,
          reviewCount,
          rating,
          marketShare,
          averagePosition: avgPosition,
          googleMapsUrl: mapUrl,
          mainCategory,
          importedAt: new Date().toISOString(),
        },
        profileSummary: `${name} - ${mainCategory || category} in Preston area. ${reviewCount} reviews, ${rating} stars. Market share: ${marketShare}%`,
      },
    });
    
    // Also create as Lead for outreach
    const email = `contact@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.local`;
    
    const lead = await prisma.lead.create({
      data: {
        email,
        firstName: name.split(' ')[0] || name,
        lastName: name.split(' ').slice(1).join(' ') || '',
        phone: phone || null,
        title: mainCategory || category,
        companyId: company.id,
        organizationId: org.id,
        ownerId: user.id,
        source: 'csv_import',
        status: 'new',
        profileJson: {
          source: 'csv_import',
          category,
          businessName: name,
          address,
          reviewCount,
          rating,
          marketShare,
          averagePosition: avgPosition,
          googleMapsUrl: mapUrl,
          website,
          mainCategory,
          importedAt: new Date().toISOString(),
        },
        profileSummary: `${name} - ${mainCategory || category}. ${address}. ${reviewCount} reviews (${rating}★). Market position: #${avgPosition}`,
      },
    });
    
    // Get default pipeline and first stage (New)
    const pipeline = await prisma.pipeline.findFirst({
      where: { organizationId: org.id },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    
    if (pipeline && pipeline.stages.length > 0) {
      // Create deal in the "New" stage
      await prisma.deal.create({
        data: {
          title: name,
          value: 0,
          status: 'open',
          pipelineId: pipeline.id,
          stageId: pipeline.stages[0].id, // First stage (New)
          leadId: lead.id,
          companyId: company.id,
          organizationId: org.id,
          ownerId: user.id,
        },
      });
    }
    
    imported++;
  }
  
  console.log(`✓ Imported ${imported} ${category}, skipped ${skipped}`);
}

async function main() {
  console.log('=== CSV Import Script ===\n');
  
  // Check for existing data
  const existingCompanies = await prisma.company.count();
  const existingLeads = await prisma.lead.count();
  const existingDeals = await prisma.deal.count();
  
  if (existingCompanies > 0 || existingLeads > 0 || existingDeals > 0) {
    console.log(`Found ${existingCompanies} companies, ${existingLeads} leads, and ${existingDeals} deals.`);
    console.log('Clearing existing data...');
    await prisma.deal.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.company.deleteMany();
  }
  
  // CSV files to import (from user's desktop)
  const csvFiles = [
    { path: 'C:\\Users\\andre\\OneDrive\\Desktop\\electrician-preston.csv', category: 'Electrician' },
    { path: 'C:\\Users\\andre\\OneDrive\\Desktop\\plumbers-preston.csv', category: 'Plumber' },
    { path: 'C:\\Users\\andre\\OneDrive\\Desktop\\roofers-preston.csv', category: 'Roofer' },
    { path: 'C:\\Users\\andre\\OneDrive\\Desktop\\joiners-preston.csv', category: 'Joiner' },
  ];
  
  for (const csv of csvFiles) {
    if (fs.existsSync(csv.path)) {
      await importCSV(csv.path, csv.category);
    } else {
      console.log(`⚠ File not found: ${csv.path}`);
    }
  }
  
  // Summary
  const totalCompanies = await prisma.company.count();
  const totalLeads = await prisma.lead.count();
  const totalDeals = await prisma.deal.count();
  
  console.log('\n=== Import Complete ===');
  console.log(`Total companies: ${totalCompanies}`);
  console.log(`Total leads: ${totalLeads}`);
  console.log(`Total deals: ${totalDeals} (all in "New" stage)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
