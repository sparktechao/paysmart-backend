// Setup file for Jest tests

// Configuração global para testes
beforeAll(async () => {
  // Configurar variáveis de ambiente para testes
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/paysmart_test';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';
});

// Limpar mocks após cada teste
afterEach(() => {
  jest.clearAllMocks();
});

// Configuração global do Jest
global.beforeEach(async () => {
  // Reset de mocks
  jest.resetAllMocks();
});

global.afterAll(async () => {
  // Cleanup global
  jest.restoreAllMocks();
}); 