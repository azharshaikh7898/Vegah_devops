import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Pool } from 'pg';

@Injectable()
export class JobsService implements OnModuleInit {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });
  private queue = new Queue('tasks', {
    connection: {
      host: process.env.REDIS_HOST,
      port: +(process.env.REDIS_PORT || 6379),
    },
  });

  async onModuleInit() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      result TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now())`);
  }

  async create(payload: string) {
    const { rows } = await this.pool.query(
      'INSERT INTO jobs(payload) VALUES($1) RETURNING *', [payload]);
    await this.queue.add('process',
      { jobId: rows[0].id, payload },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    return rows[0];
  }

  async list() {
    const { rows } = await this.pool.query(
      'SELECT * FROM jobs ORDER BY id DESC LIMIT 20');
    return rows;
  }

  async get(id: number) {
    const { rows } = await this.pool.query('SELECT * FROM jobs WHERE id=$1', [id]);
    return rows[0] ?? null;
  }

  async ping() { await this.pool.query('SELECT 1'); }
}
