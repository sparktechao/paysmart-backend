import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Configuração global para testes e2e
beforeAll(async () => {
  // Configurar variáveis de ambiente para testes e2e
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/paysmart_test';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-testing-only';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-e2e-testing-only';
  process.env.PORT = '3001';
});

// Limpar após cada teste
afterEach(async () => {
  // Cleanup específico para e2e
});

// Configuração global do Jest para e2e
global.beforeEach(async () => {
  // Setup específico para cada teste e2e
});

global.afterAll(async () => {
  // Cleanup global para e2e
}); 