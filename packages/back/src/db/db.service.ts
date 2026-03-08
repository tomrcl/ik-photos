import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import * as relations from './relations';

@Injectable()
export class DbService implements OnModuleDestroy {
  public pool: pg.Pool;
  public db: NodePgDatabase<typeof schema & typeof relations>;

  constructor() {
    this.pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    this.db = drizzle(this.pool, { schema: { ...schema, ...relations } });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
