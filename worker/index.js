import { Worker } from 'bullmq';
import pg from 'pg';
import http from 'http';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const connection = {
  host: process.env.REDIS_HOST,
  port: +(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
};

const worker = new Worker('tasks', async (job) => {
  const { jobId, payload } = job.data;
  await pool.query("UPDATE jobs SET status='processing', updated_at=now() WHERE id=$1", [jobId]);
  await new Promise((r) => setTimeout(r, 5000)); // simulate work
  const result = payload.toUpperCase().split('').reverse().join('');
  await pool.query("UPDATE jobs SET status='completed', result=$2, updated_at=now() WHERE id=$1", [jobId, result]);
  return result;
}, { connection, concurrency: 2 });

worker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
    await pool.query("UPDATE jobs SET status='failed', result=$2, updated_at=now() WHERE id=$1",
      [job.data.jobId, err.message]);
  }
});

// Health endpoint for Docker healthcheck
http.createServer((req, res) => {
  const ok = worker.isRunning();
  res.writeHead(ok ? 200 : 503).end(ok ? 'ok' : 'down');
}).listen(3002);

process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });
