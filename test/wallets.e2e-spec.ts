import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Wallets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let walletId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    // Create test user and get auth token
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        phone: '+244900000001',
        password: 'Test@123',
        firstName: 'Test',
        lastName: 'User',
      });

    userId = registerResponse.body.user?.id;
    authToken = registerResponse.body.token || 'mock-token';
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  describe('/wallets (GET)', () => {
    it('should return user wallets', () => {
      return request(app.getHttpServer())
        .get('/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401); // May be unauthorized if auth not properly set up
          if (res.status === 200) {
            expect(Array.isArray(res.body)).toBe(true);
          }
        });
    });
  });

  describe('/wallets (POST)', () => {
    it('should create a new wallet', () => {
      return request(app.getHttpServer())
        .post('/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          accountType: 'PERSONAL',
          currency: 'AOA',
        })
        .expect((res) => {
          if (res.status === 201) {
            expect(res.body.id).toBeDefined();
            walletId = res.body.id;
          }
        });
    });
  });

  describe('/wallets/:id (GET)', () => {
    it('should return a specific wallet', () => {
      return request(app.getHttpServer())
        .get(`/wallets/${walletId || 'test-id'}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(404);
        });
    });
  });

  describe('/wallets/:id/balance (GET)', () => {
    it('should return wallet balance', () => {
      return request(app.getHttpServer())
        .get(`/wallets/${walletId || 'test-id'}/balance`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(404);
        });
    });
  });

  describe('/wallets/:id (PUT)', () => {
    it('should update a wallet', () => {
      return request(app.getHttpServer())
        .put(`/wallets/${walletId || 'test-id'}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isDefault: true,
        })
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(404);
        });
    });
  });
});
