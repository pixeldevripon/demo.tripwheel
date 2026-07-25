// Mock the Better Auth singleton so the ESM `better-auth` package is never
// loaded in the unit test (it is not needed for these smoke tests).
jest.mock('@/auth/auth.instance', () => ({
  auth: {
    $context: Promise.resolve({
      password: { hash: jest.fn() },
      internalAdapter: {
        createUser: jest.fn(),
        linkAccount: jest.fn(),
        deleteUser: jest.fn(),
      },
    }),
    api: { requestPasswordReset: jest.fn() },
  },
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentProvider, Role } from '@prisma/client';
import { OperatorsService } from './operators.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrismaService = {
  operator: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn(), update: jest.fn() },
  operatorCompanyInfo: { upsert: jest.fn(), findUnique: jest.fn() },
  operatorSocialMedia: { upsert: jest.fn(), findUnique: jest.fn() },
  operatorStripeConfig: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  operatorMollieConfig: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
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

  // The operator-level PSP switch mirrors the platform payment_settings switch:
  // owner-only, and the TARGET provider must already be configured (400).
  describe('payment provider switch', () => {
    const operator = (over: Record<string, unknown> = {}) => ({
      id: 'op1',
      userId: 'owner1',
      activePaymentProvider: PaymentProvider.STRIPE,
      updatedAt: new Date('2026-07-25T12:00:00Z'),
      user: { id: 'owner1' },
      ...over,
    });

    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.operator.findUnique.mockResolvedValue(operator());
      mockPrismaService.operatorStripeConfig.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.operatorMollieConfig.updateMany.mockResolvedValue({
        count: 1,
      });
    });

    it('returns the active provider to the owner', async () => {
      const res = await service.getPaymentProvider(
        'op1',
        'owner1',
        Role.TOUR_OPERATOR,
      );
      expect(res.activeProvider).toBe(PaymentProvider.STRIPE);
    });

    it('rejects a non-owner operator account (owner-only gate)', async () => {
      await expect(
        service.getPaymentProvider('op1', 'someone-else', Role.TOUR_OPERATOR),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('switches to Mollie when its API key is configured + syncs isActive flags', async () => {
      mockPrismaService.operatorMollieConfig.findUnique.mockResolvedValue({
        apiKey: 'enc:key',
      });
      mockPrismaService.operator.update.mockResolvedValue({
        activePaymentProvider: PaymentProvider.MOLLIE,
        updatedAt: new Date('2026-07-25T13:00:00Z'),
      });

      const res = await service.updatePaymentProvider(
        'op1',
        'owner1',
        Role.TOUR_OPERATOR,
        { activeProvider: PaymentProvider.MOLLIE },
      );

      expect(res.activeProvider).toBe(PaymentProvider.MOLLIE);
      expect(mockPrismaService.operator.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'op1' },
          data: { activePaymentProvider: PaymentProvider.MOLLIE },
        }),
      );
      expect(
        mockPrismaService.operatorStripeConfig.updateMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(
        mockPrismaService.operatorMollieConfig.updateMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
    });

    it('rejects switching to an unconfigured Mollie (400)', async () => {
      mockPrismaService.operatorMollieConfig.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePaymentProvider('op1', 'owner1', Role.TOUR_OPERATOR, {
          activeProvider: PaymentProvider.MOLLIE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaService.operator.update).not.toHaveBeenCalled();
    });

    it('rejects switching to Stripe without secret + webhook secret (400)', async () => {
      mockPrismaService.operatorStripeConfig.findUnique.mockResolvedValue({
        secretKey: 'enc:sk',
        webhookSecret: '',
      });
      await expect(
        service.updatePaymentProvider('op1', 'owner1', Role.TOUR_OPERATOR, {
          activeProvider: PaymentProvider.STRIPE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaService.operator.update).not.toHaveBeenCalled();
    });
  });
});
