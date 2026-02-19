import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { DbModule } from './db/db.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { KdriveModule } from './kdrive/kdrive.module';
import { DrivesModule } from './drives/drives.module';
import { PhotosModule } from './photos/photos.module';
import { IndexationModule } from './indexation/indexation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().optional(),
        DB_HOST: Joi.string().optional(),
        DB_PORT: Joi.number().default(5432),
        DB_NAME: Joi.string().optional(),
        DB_USERNAME: Joi.string().optional(),
        DB_PASSWORD: Joi.string().optional().allow(''),
        LOCAL_MODE: Joi.string().valid('true').optional(),
        INFOMANIAK_TOKEN: Joi.string().optional(),
        JWT_SECRET: Joi.string().when('LOCAL_MODE', {
          is: 'true',
          then: Joi.string().default('local-dev-secret'),
          otherwise: Joi.string().required(),
        }),
        JWT_EXPIRY: Joi.string().default('15m'),
        REFRESH_TOKEN_EXPIRY: Joi.string().default('7d'),
        ENCRYPTION_KEY: Joi.string().when('LOCAL_MODE', {
          is: 'true',
          then: Joi.string().default('00'.repeat(32)),
          otherwise: Joi.string().required(),
        }),
        KDRIVE_API_BASE: Joi.string().default('https://api.kdrive.infomaniak.com'),
        REINDEX_CRON: Joi.string().default('0 */6 * * *'),
        PORT: Joi.number().default(3004),
        CORS_ORIGIN: Joi.string().default('http://localhost:3003'),
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    DbModule,
    CryptoModule,
    AuthModule,
    KdriveModule,
    DrivesModule,
    PhotosModule,
    IndexationModule,
  ],
})
export class AppModule {}
