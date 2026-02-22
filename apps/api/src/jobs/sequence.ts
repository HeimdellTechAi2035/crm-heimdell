import { Queue } from 'bullmq';
import { config } from '../config.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

/**
 * Queue for processing sequence steps (sending emails, creating tasks, etc.)
 * Jobs are added when a sequence enrollment reaches its next step.
 */
export const sequenceQueue = new Queue('sequence-steps', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});
