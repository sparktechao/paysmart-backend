import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getInfo', () => {
    it('should return API information', () => {
      const result = appController.getInfo();
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('version');
      expect(result.name).toBe('PaySmart Premium API');
    });
  });
});
