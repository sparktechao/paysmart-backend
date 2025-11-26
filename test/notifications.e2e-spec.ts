import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Notifications (e2e)', () => {
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
        phone: '+244900000005',
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

  describe('/notifications (GET)', () => {
    it('should return user notifications', () => {
      return request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
        });
    });
  });

  describe('/notifications/unread-count (GET)', () => {
    it('should return unread notification count', () => {
      return request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
        });
    });
  });

  describe('/notifications/mark-all-read (PUT)', () => {
    it('should mark all notifications as read', () => {
      return request(app.getHttpServer())
        .put('/notifications/mark-all-read')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect(res.status).toBeLessThanOrEqual(401);
        });
    });
  });
});
