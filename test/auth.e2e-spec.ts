import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    const validRegisterDto = {
      phone: '+244123456789',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      gender: 'MALE',
      documentType: 'BI',
      documentNumber: '123456789LA123',
      documentExpiry: '2030-01-01',
      pin: '1234',
    };

    it('deve registrar novo usuário com sucesso', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validRegisterDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.phone).toBe(validRegisterDto.phone);
        });
    });

    it('deve retornar erro 400 se telefone já estiver registrado', async () => {
      // Primeiro registro
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validRegisterDto, phone: '+244999999999' });

      // Tentativa de registro duplicado
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validRegisterDto, phone: '+244999999999' })
        .expect(400);
    });

    it('deve retornar erro 400 se dados inválidos', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: 'invalid-phone',
          pin: '12', // PIN muito curto
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const loginDto = {
      phone: '+244123456789',
      pin: '1234',
    };

    it('deve fazer login com sucesso se credenciais forem válidas', async () => {
      // Primeiro criar usuário
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: loginDto.phone,
          email: 'login@example.com',
          firstName: 'Login',
          lastName: 'Test',
          dateOfBirth: '1990-01-01',
          gender: 'MALE',
          documentType: 'BI',
          documentNumber: '987654321LA123',
          documentExpiry: '2030-01-01',
          pin: loginDto.pin,
        });

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginDto)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');
        });
    });

    it('deve retornar erro 401 se credenciais forem inválidas', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: '+244000000000',
          pin: 'wrong-pin',
        })
        .expect(401);
    });
  });
});

