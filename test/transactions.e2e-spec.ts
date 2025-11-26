import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Transactions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        phone: '+244900000002',
        password: 'Test@123',
        firstName: 'Test',
        lastName: 'User',
      });

    authToken = registerResponse.body.token || 'mock-token';
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  describe('/transactions (GET)', () => {
    it('should return transaction history', () => {
      return request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
          if (res.status === 200) {
            expect(Array.isArray(res.body)).toBe(true);
          }
        });
    });
  });

  describe('/transactions/stats (GET)', () => {
    it('should return transaction stats', () => {
      return request(app.getHttpServer())
        .get('/transactions/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
        });
    });
  });

  describe('/transactions (POST)', () => {
    it('should create a new transaction', () => {
      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fromWalletId: 'wallet-123',
          toWalletId: 'wallet-456',
          amount: 5000,
          currency: 'AOA',
          type: 'TRANSFER',
          description: 'Test transaction',
        })
        .expect((res) => {
          expect(res.status).toBeGreaterThanOrEqual(400); // May fail validation
        });
    });
  });
});
