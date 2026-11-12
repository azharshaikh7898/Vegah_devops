import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { JobsService } from './jobs.service.js';

@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('health')
  async health() { await this.jobs.ping(); return { status: 'ok' }; }

  @Post('jobs')
  create(@Body() body: { payload: string }) { return this.jobs.create(body.payload); }

  @Get('jobs')
  list() { return this.jobs.list(); }

  @Get('jobs/:id')
  get(@Param('id') id: string) { return this.jobs.get(+id); }
}
