import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        BULL_REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        SOCKET_CORS_ORIGIN: Joi.string().default('*'),
        UPLOAD_DEST: Joi.string().default('./uploads'),
        MAX_FILE_SIZE: Joi.number().default(10485760),
        SMTP_HOST: Joi.string().allow('').optional(),
        SMTP_PORT: Joi.number().optional(),
        SMTP_USER: Joi.string().allow('').optional(),
        SMTP_PASS: Joi.string().allow('').optional(),
        TWILIO_ACCOUNT_SID: Joi.string().allow('').optional(),
        TWILIO_AUTH_TOKEN: Joi.string().allow('').optional(),
        TWILIO_PHONE_NUMBER: Joi.string().allow('').optional(),
        BCRYPT_ROUNDS: Joi.number().default(12),
        RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
        RATE_LIMIT_MAX: Joi.number().default(100),
        LOG_LEVEL: Joi.string()
          .valid('error', 'warn', 'info', 'debug')
          .default('info'),
        LOG_FILE_PATH: Joi.string().default('./logs'),
      }),
    }),
  ],
})
export class ConfigModule {} 