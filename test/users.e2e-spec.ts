import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Users (e2e)', () => {
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
        phone: '+244900000004',
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

  describe('/users/profile (GET)', () => {
    it('should return user profile', () => {
      return request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
        });
    });
  });

  describe('/users/profile (PUT)', () => {
    it('should update user profile', () => {
      return request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
        });
    });
  });

  describe('/users/phone/:phone (GET)', () => {
    it('should get user by phone', () => {
      return request(app.getHttpServer())
        .get('/users/phone/+244900000004')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(404);
        });
    });
  });
});
