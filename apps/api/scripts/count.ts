import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.count();
  const leads = await prisma.lead.count();
  const deals = await prisma.deal.count();
  
  console.log('=== Database Counts ===');
  console.log('Companies:', companies);
  console.log('Leads:', leads);
  console.log('Deals:', deals);
  
  // Check deals by stage
  const stages = await prisma.stage.findMany({
    include: { _count: { select: { deals: true } } }
  });
  
  console.log('\n=== Deals by Stage ===');
  for (const stage of stages) {
    console.log(`${stage.name}: ${stage._count.deals}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
