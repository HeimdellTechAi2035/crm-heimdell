import { config } from '../config.js';
import { createQueue, IJobQueue } from '../lib/queue.js';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../lib/email.js';

export const digestQueue: IJobQueue = createQueue(
  'digests',
  config.features.redis,
  config.redis.url
);

export function startDigestWorker() {
  digestQueue.registerProcessor('daily-digest', async (job) => {
    return await sendDailyDigest(job.data.userId);
  });
}

async function sendDailyDigest(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: true,
    },
  });

  if (!user || !user.isActive) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get tasks due today
  const tasksDueToday = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { not: 'DONE' },
      dueDate: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      lead: true,
      deal: true,
    },
  });

  // Get overdue tasks
  const overdueTasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { not: 'DONE' },
      dueDate: {
        lt: today,
      },
    },
    include: {
      lead: true,
      deal: true,
    },
    take: 10,
  });

  // Get stale deals (no activity in 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const staleDeals = await prisma.deal.findMany({
    where: {
      ownerId: userId,
      status: 'open',
      updatedAt: {
        lt: sevenDaysAgo,
      },
    },
    include: {
      stage: true,
      company: true,
      lead: true,
    },
    take: 5,
  });

  if (tasksDueToday.length === 0 && overdueTasks.length === 0 && staleDeals.length === 0) {
    console.log(`No digest content for user ${userId}`);
    return;
  }

  // Build email HTML
  let html = `
    <h2>Daily Digest - ${today.toLocaleDateString('en-GB')}</h2>
    <p>Hello ${user.firstName},</p>
  `;

  if (tasksDueToday.length > 0) {
    html += `
      <h3>Tasks Due Today (${tasksDueToday.length})</h3>
      <ul>
        ${tasksDueToday.map((t: any) => `
          <li><strong>${t.title}</strong>
            ${t.lead ? ` - ${t.lead.firstName} ${t.lead.lastName}` : ''}
            ${t.deal ? ` - ${t.deal.title}` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }

  if (overdueTasks.length > 0) {
    html += `
      <h3 style="color: red;">Overdue Tasks (${overdueTasks.length})</h3>
      <ul>
        ${overdueTasks.map((t: any) => `
          <li><strong>${t.title}</strong> (Due: ${t.dueDate?.toLocaleDateString('en-GB')})
            ${t.lead ? ` - ${t.lead.firstName} ${t.lead.lastName}` : ''}
            ${t.deal ? ` - ${t.deal.title}` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }

  if (staleDeals.length > 0) {
    html += `
      <h3>Stale Deals (No activity in 7+ days)</h3>
      <ul>
        ${staleDeals.map((d: any) => {
          const daysSince = Math.floor((Date.now() - d.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
          return `
            <li><strong>${d.title}</strong> (£${d.value}) - ${d.stage.name}
              <br><small>Last updated ${daysSince} days ago</small>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  html += `
    <p>Have a productive day!</p>
    <p><small>Heimdell CRM</small></p>
  `;

  await sendEmail(
    user.email,
    `Daily Digest - ${tasksDueToday.length + overdueTasks.length} tasks, ${staleDeals.length} stale deals`,
    html
  );
}

// Schedule daily digests for all active users
export async function scheduleDailyDigests() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const user of users) {
    await digestQueue.add(
      'daily-digest',
      { userId: user.id },
      {
        repeat: {
          pattern: '0 8 * * *', // 8 AM daily
        },
      }
    );
  }
}


