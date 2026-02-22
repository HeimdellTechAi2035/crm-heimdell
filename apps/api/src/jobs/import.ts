import { Queue } from 'bullmq';
import { config } from '../config.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

/**
 * Queue for processing CSV import jobs in the background.
 * Jobs are added after a user uploads a CSV and submits field mapping.
 */
export const importQueue = new Queue('csv-imports', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});
