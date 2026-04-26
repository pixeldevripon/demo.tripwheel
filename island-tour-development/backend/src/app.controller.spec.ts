import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = module.get(AppController);
  });

  describe('GET /health', () => {
    it('returns status ok', () => {
      expect(appController.getHealth().status).toBe('ok');
    });

    it('returns a valid ISO timestamp', () => {
      const { timestamp } = appController.getHealth();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('returns a non-negative integer uptime', () => {
      const { uptime } = appController.getHealth();
      expect(typeof uptime).toBe('number');
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(uptime)).toBe(true);
    });

    it('does not expose environment or internal fields', () => {
      const result = appController.getHealth();
      expect(result).not.toHaveProperty('environment');
      expect(Object.keys(result)).toEqual(['status', 'timestamp', 'uptime']);
    });
  });
});
