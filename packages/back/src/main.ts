import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './app.module';
import { DbService } from './db/db.service';
import { CryptoService } from './crypto/crypto.service';
import { account } from './db/schema';

// Build DATABASE_URL from individual DB_* vars if not set directly
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  const user = process.env.DB_USERNAME ?? 'postgres';
  const pass = process.env.DB_PASSWORD ?? '';
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ?? '5432';
  const name = process.env.DB_NAME ?? 'postgres';
  process.env.DATABASE_URL = `postgresql://${user}:${pass}@${host}:${port}/${name}`;
}

function logMemory(label: string) {
  const mem = process.memoryUsage();
  console.log(`[MEM ${label}] RSS=${Math.round(mem.rss / 1024 / 1024)}MB Heap=${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
}

// Catch any uncaught error to see what kills the process
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});
process.on('SIGTERM', () => {
  console.log('Received SIGTERM');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('Received SIGINT');
  process.exit(0);
});

async function bootstrap() {
  logMemory('start');

  const app = await NestFactory.create(AppModule);
  logMemory('after create');

  if (process.env.LOCAL_MODE === 'true' && process.env.NODE_ENV === 'production') {
    console.error('FATAL: LOCAL_MODE must not be enabled in production');
    process.exit(1);
  }

  if (process.env.LOCAL_MODE === 'true') {
    const dbService = app.get(DbService);
    const cryptoService = app.get(CryptoService);

    let [localAccount] = await dbService.db
      .select()
      .from(account)
      .where(eq(account.email, 'local'))
      .limit(1);

    if (!localAccount) {
      const passwordHash = await bcrypt.hash('local', 12);
      const encryptedToken = cryptoService.encrypt('');
      [localAccount] = await dbService.db
        .insert(account)
        .values({ email: 'local', passwordHash, infomaniakToken: encryptedToken })
        .returning();
    }

    const decryptedToken = cryptoService.decrypt(localAccount.infomaniakToken);
    if (!decryptedToken && process.env.INFOMANIAK_TOKEN) {
      const encryptedToken = cryptoService.encrypt(process.env.INFOMANIAK_TOKEN);
      await dbService.db
        .update(account)
        .set({ infomaniakToken: encryptedToken })
        .where(eq(account.id, localAccount.id));
    } else if (!decryptedToken) {
      console.warn('⚠ No Infomaniak token configured. Set INFOMANIAK_TOKEN in .env');
    }

    process.env.LOCAL_ACCOUNT_ID = localAccount.id;
    console.log(`✓ Local account ready (id: ${localAccount.id})`);
  }

  const config = app.get(ConfigService);

  app.use(cookieParser());
  app.use(compression());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3003'),
    credentials: true,
  });

  const port = config.get<number>('PORT', 3004);
  const host = process.env.HOST ?? '::';
  await app.listen(port, host);
  logMemory('after listen');
  console.log(`Backend running on http://${host}:${port}`);

  // Log memory every 30s to track growth
  setInterval(() => logMemory('periodic'), 30000);
}
bootstrap().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
