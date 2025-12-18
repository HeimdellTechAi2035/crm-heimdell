/**
 * Job Queue Abstraction
 * Allows running with or without Redis/BullMQ
 */

export interface IJobQueue {
  enqueue(name: string, payload: any, opts?: any): Promise<void>;
  registerProcessor(name: string, handler: (job: any) => Promise<void>): void;
  getStats(): Promise<{ pending: number; completed: number; failed: number }>;
  close(): Promise<void>;
}

/**
 * In-Memory Queue Implementation
 * Executes jobs inline (no Redis required)
 */
export class InMemoryQueue implements IJobQueue {
  private processors = new Map<string, (job: any) => Promise<void>>();
  private stats = { pending: 0, completed: 0, failed: 0 };

  async enqueue(name: string, payload: any, opts?: any): Promise<void> {
    const processor = this.processors.get(name);
    
    if (!processor) {
      console.warn(`⚠️  No processor registered for job: ${name}`);
      return;
    }

    this.stats.pending++;
    
    // Execute inline (in next tick to avoid blocking)
    setImmediate(async () => {
      try {
        await processor({ data: payload, name });
        this.stats.pending--;
        this.stats.completed++;
      } catch (error) {
        console.error(`Failed to process job ${name}:`, error);
        this.stats.pending--;
        this.stats.failed++;
      }
    });
  }

  registerProcessor(name: string, handler: (job: any) => Promise<void>): void {
    this.processors.set(name, handler);
  }

  async getStats(): Promise<{ pending: number; completed: number; failed: number }> {
    return { ...this.stats };
  }

  async close(): Promise<void> {
    this.processors.clear();
  }
}

/**
 * BullMQ Queue Wrapper
 * Uses Redis for background job processing
 */
export class BullMqQueue implements IJobQueue {
  private queue: any;
  private worker: any;

  constructor(queueName: string, redisConnection: any) {
    // Lazy import to avoid loading BullMQ when not needed
    const { Queue, Worker } = require('bullmq');
    
    this.queue = new Queue(queueName, {
      connection: redisConnection,
    });
  }

  async enqueue(name: string, payload: any, opts?: any): Promise<void> {
    await this.queue.add(name, payload, opts);
  }

  registerProcessor(name: string, handler: (job: any) => Promise<void>): void {
    if (!this.worker) {
      const { Worker } = require('bullmq');
      this.worker = new Worker(
        this.queue.name,
        async (job: any) => {
          await handler(job);
        },
        { connection: this.queue.opts.connection }
      );
    }
  }

  async getStats(): Promise<{ pending: number; completed: number; failed: number }> {
    const counts = await this.queue.getJobCounts('wait', 'completed', 'failed');
    return {
      pending: counts.wait || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
    };
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
  }
}

/**
 * Create appropriate queue based on config
 */
export function createQueue(name: string, redisEnabled: boolean, redisUrl?: string): IJobQueue {
  if (!redisEnabled) {
    console.log(`📋 Using in-memory queue for: ${name}`);
    return new InMemoryQueue();
  }

  try {
    const Redis = require('ioredis');
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    
    console.log(`📋 Using BullMQ queue for: ${name}`);
    return new BullMqQueue(name, connection);
  } catch (error) {
    console.warn(`⚠️  Failed to create Redis queue, falling back to in-memory: ${error}`);
    return new InMemoryQueue();
  }
}
