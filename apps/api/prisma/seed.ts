import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create organization
  const org = await prisma.organization.upsert({
    where: { id: 'demo-org' },
    update: {},
    create: {
      id: 'demo-org',
      name: 'Demo Company Ltd',
      currency: 'GBP',
      locale: 'en-GB',
      aiMonthlyLimit: 10000,
    },
  });

  console.log('✓ Created organization');

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const repPassword = await bcrypt.hash('rep123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@heimdell.com' },
    update: {},
    create: {
      email: 'admin@heimdell.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@heimdell.com' },
    update: {},
    create: {
      email: 'manager@heimdell.com',
      passwordHash: managerPassword,
      firstName: 'Manager',
      lastName: 'Smith',
      role: 'MANAGER',
      organizationId: org.id,
    },
  });

  const rep = await prisma.user.upsert({
    where: { email: 'rep@heimdell.com' },
    update: {},
    create: {
      email: 'rep@heimdell.com',
      passwordHash: repPassword,
      firstName: 'Sales',
      lastName: 'Rep',
      role: 'SALES_REP',
      organizationId: org.id,
    },
  });

  console.log('✓ Created users');

  // Create pipeline
  const pipeline = await prisma.pipeline.upsert({
    where: { id: 'default-pipeline' },
    update: {},
    create: {
      id: 'default-pipeline',
      name: 'Sales Pipeline',
      organizationId: org.id,
      isDefault: true,
    },
  });

  const stages = await Promise.all([
    prisma.stage.upsert({
      where: { id: 'stage-lead' },
      update: {},
      create: {
        id: 'stage-lead',
        name: 'Lead',
        pipelineId: pipeline.id,
        position: 0,
        probability: 10,
      },
    }),
    prisma.stage.upsert({
      where: { id: 'stage-qualified' },
      update: {},
      create: {
        id: 'stage-qualified',
        name: 'Qualified',
        pipelineId: pipeline.id,
        position: 1,
        probability: 25,
      },
    }),
    prisma.stage.upsert({
      where: { id: 'stage-proposal' },
      update: {},
      create: {
        id: 'stage-proposal',
        name: 'Proposal',
        pipelineId: pipeline.id,
        position: 2,
        probability: 50,
      },
    }),
    prisma.stage.upsert({
      where: { id: 'stage-negotiation' },
      update: {},
      create: {
        id: 'stage-negotiation',
        name: 'Negotiation',
        pipelineId: pipeline.id,
        position: 3,
        probability: 75,
      },
    }),
    prisma.stage.upsert({
      where: { id: 'stage-closed-won' },
      update: {},
      create: {
        id: 'stage-closed-won',
        name: 'Closed Won',
        pipelineId: pipeline.id,
        position: 4,
        probability: 100,
      },
    }),
  ]);

  console.log('✓ Created pipeline and stages');

  // Create sample companies
  const companies = await Promise.all([
    prisma.company.create({
      data: {
        name: 'Tech Solutions Ltd',
        domain: 'techsolutions.co.uk',
        industry: 'Technology',
        size: '50-200',
        location: 'London',
        website: 'https://techsolutions.co.uk',
        ownerId: rep.id,
        organizationId: org.id,
      },
    }),
    prisma.company.create({
      data: {
        name: 'Marketing Plus Agency',
        domain: 'marketingplus.co.uk',
        industry: 'Marketing',
        size: '10-50',
        location: 'Manchester',
        website: 'https://marketingplus.co.uk',
        ownerId: rep.id,
        organizationId: org.id,
      },
    }),
    prisma.company.create({
      data: {
        name: 'Finance Corp',
        domain: 'financecorp.co.uk',
        industry: 'Finance',
        size: '200+',
        location: 'Edinburgh',
        ownerId: rep.id,
        organizationId: org.id,
      },
    }),
  ]);

  console.log('✓ Created sample companies');

  // Create sample leads
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        email: 'john.smith@techsolutions.co.uk',
        firstName: 'John',
        lastName: 'Smith',
        phone: '+44 20 1234 5678',
        title: 'CTO',
        companyId: companies[0].id,
        ownerId: rep.id,
        organizationId: org.id,
        status: 'qualified',
        source: 'website',
      },
    }),
    prisma.lead.create({
      data: {
        email: 'sarah.jones@marketingplus.co.uk',
        firstName: 'Sarah',
        lastName: 'Jones',
        phone: '+44 161 234 5678',
        title: 'Marketing Director',
        companyId: companies[1].id,
        ownerId: rep.id,
        organizationId: org.id,
        status: 'new',
        source: 'referral',
      },
    }),
    prisma.lead.create({
      data: {
        email: 'mike.brown@financecorp.co.uk',
        firstName: 'Mike',
        lastName: 'Brown',
        title: 'Operations Manager',
        companyId: companies[2].id,
        ownerId: rep.id,
        organizationId: org.id,
        status: 'contacted',
        source: 'cold outreach',
      },
    }),
  ]);

  console.log('✓ Created sample leads');

  // Create sample deals
  const deals = await Promise.all([
    prisma.deal.create({
      data: {
        title: 'CRM Implementation - Tech Solutions',
        value: 25000,
        currency: 'GBP',
        pipelineId: pipeline.id,
        stageId: stages[2].id, // Proposal
        leadId: leads[0].id,
        companyId: companies[0].id,
        ownerId: rep.id,
        organizationId: org.id,
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Marketing Automation - Marketing Plus',
        value: 15000,
        currency: 'GBP',
        pipelineId: pipeline.id,
        stageId: stages[1].id, // Qualified
        leadId: leads[1].id,
        companyId: companies[1].id,
        ownerId: rep.id,
        organizationId: org.id,
        expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  console.log('✓ Created sample deals');

  // Create sample activities
  await Promise.all([
    prisma.activity.create({
      data: {
        type: 'EMAIL',
        subject: 'Introduction to Heimdell CRM',
        body: 'Hi John, I wanted to reach out...',
        leadId: leads[0].id,
        userId: rep.id,
        organizationId: org.id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'CALL',
        subject: 'Discovery call',
        body: 'Had a great conversation about their needs...',
        leadId: leads[0].id,
        dealId: deals[0].id,
        userId: rep.id,
        organizationId: org.id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'NOTE',
        subject: 'Follow-up required',
        body: 'Sarah mentioned they are reviewing options this month',
        leadId: leads[1].id,
        userId: rep.id,
        organizationId: org.id,
      },
    }),
  ]);

  console.log('✓ Created sample activities');

  // Create sample tasks
  await Promise.all([
    prisma.task.create({
      data: {
        title: 'Send proposal to John',
        description: 'Include pricing for 50 users',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        priority: 'high',
        leadId: leads[0].id,
        dealId: deals[0].id,
        userId: rep.id,
        assigneeId: rep.id,
        organizationId: org.id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Follow up with Sarah',
        description: 'Check if she received the demo link',
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        priority: 'medium',
        leadId: leads[1].id,
        userId: rep.id,
        assigneeId: rep.id,
        organizationId: org.id,
      },
    }),
  ]);

  console.log('✓ Created sample tasks');

  // Create email template
  await prisma.emailTemplate.create({
    data: {
      name: 'Cold Outreach Template',
      subject: 'Quick question about {company}',
      body: `Hi {firstName},

I noticed {company} is in the {industry} industry, and I thought our CRM solution might be relevant for you.

We help companies like yours streamline their sales process and close more deals.

Would you be open to a quick 15-minute call this week?

Best regards,
Sales Rep
Heimdell CRM`,
      organizationId: org.id,
    },
  });

  console.log('✓ Created email template');

  console.log('\n✅ Seeding complete!');
  console.log('\nDemo accounts:');
  console.log('  Admin:   admin@heimdell.com / admin123');
  console.log('  Manager: manager@heimdell.com / manager123');
  console.log('  Rep:     rep@heimdell.com / rep123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
