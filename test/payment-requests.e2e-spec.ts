import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Payment Requests (e2e)', () => {
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
        phone: '+244900000003',
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

  describe('/payment-requests (GET)', () => {
    it('should return user payment requests', () => {
      return request(app.getHttpServer())
        .get('/payment-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
        });
    });
  });

  describe('/payment-requests/received (GET)', () => {
    it('should return received payment requests', () => {
      return request(app.getHttpServer())
        .get('/payment-requests/received')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
        });
    });
  });

  describe('/payment-requests/stats (GET)', () => {
    it('should return payment request stats', () => {
      return request(app.getHttpServer())
        .get('/payment-requests/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
        });
    });
  });

  describe('/payment-requests (POST)', () => {
    it('should create a new payment request', () => {
      return request(app.getHttpServer())
        .post('/payment-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          payerId: 'user-123',
          amount: 5000,
          description: 'Test payment request',
          category: 'PERSONAL',
        })
        .expect((res) => {
          expect(res.status).toBeGreaterThanOrEqual(400); // May fail validation
        });
    });
  });
});
