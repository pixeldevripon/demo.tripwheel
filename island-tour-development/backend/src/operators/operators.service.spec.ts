import { Test, TestingModule } from '@nestjs/testing';
import { OperatorsService } from './operators.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrismaService = {
  operator: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
  operatorCompanyInfo: { upsert: jest.fn(), findUnique: jest.fn() },
  operatorSocialMedia: { upsert: jest.fn(), findUnique: jest.fn() },
  operatorStripeConfig: { upsert: jest.fn(), findUnique: jest.fn() },
  operatorMollieConfig: { upsert: jest.fn(), findUnique: jest.fn() },
};

describe('OperatorsService', () => {
  let service: OperatorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperatorsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OperatorsService>(OperatorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
