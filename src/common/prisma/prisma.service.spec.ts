import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should extend PrismaClient', () => {
    expect(service).toBeDefined();
    expect(service).toHaveProperty('$connect');
    expect(service).toHaveProperty('$disconnect');
  });

  describe('onModuleInit', () => {
    it('should call $connect', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalled();
      connectSpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue();

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalled();
      disconnectSpy.mockRestore();
    });
  });

  describe('cleanDatabase', () => {
    it('should clean database in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const queryRawSpy = jest.spyOn(service, '$queryRaw').mockResolvedValue([
        { tablename: 'users' },
        { tablename: 'transactions' },
        { tablename: '_prisma_migrations' },
      ]);
      const executeRawSpy = jest.spyOn(service, '$executeRawUnsafe').mockResolvedValue(0);

      await service.cleanDatabase();

      expect(queryRawSpy).toHaveBeenCalled();
      expect(executeRawSpy).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      queryRawSpy.mockRestore();
      executeRawSpy.mockRestore();
    });

    it('should not clean database in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const queryRawSpy = jest.spyOn(service, '$queryRaw');
      const executeRawSpy = jest.spyOn(service, '$executeRawUnsafe');

      await service.cleanDatabase();

      expect(queryRawSpy).not.toHaveBeenCalled();
      expect(executeRawSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      queryRawSpy.mockRestore();
      executeRawSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const queryRawSpy = jest.spyOn(service, '$queryRaw').mockResolvedValue([
        { tablename: 'users' },
      ]);
      const executeRawSpy = jest.spyOn(service, '$executeRawUnsafe').mockRejectedValue(new Error('DB Error'));
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      await service.cleanDatabase();

      expect(loggerErrorSpy).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      queryRawSpy.mockRestore();
      executeRawSpy.mockRestore();
      loggerErrorSpy.mockRestore();
    });
  });
});
