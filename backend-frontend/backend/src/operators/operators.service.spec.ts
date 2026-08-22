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

// The invite util touches Better Auth + Prisma internals; the create() test
// only cares that the operator row is born PENDING and that INT-1 fires.
jest.mock('@/common/utils/invite-provisioning.util', () => ({
  getPortalUrl: () => 'http://localhost:3001/portal',
  provisionOrAttachAccount: jest.fn().mockResolvedValue({
    email: 'mayra@irietours.com',
    user: { id: 'user-new' },
    created: true,
    hadPassword: false,
  }),
  rollbackProvisionOrAttach: jest.fn().mockResolvedValue(undefined),
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentProvider, Role } from '@prisma/client';
import { EmailLogService } from '@/mail/email-log.service';
import { EmailSettingsService } from '@/mail/email-settings.service';
import { MailService } from '@/mail/mail.service';
import { OnboardingEmailsService } from '@/mail/onboarding-emails.service';
import { OperatorsService } from './operators.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';

const mockPrismaService = {
  operator: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn(), update: jest.fn() },
  staffMember: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  staffDesignation: { createMany: jest.fn() },
  operatorCompanyInfo: { upsert: jest.fn(), findUnique: jest.fn() },
  operatorSocialMedia: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  operatorStripeConfig: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  operatorMollieConfig: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  tour: { count: jest.fn() },
  booking: { count: jest.fn() },
  review: { count: jest.fn() },
  spotlightRequest: { count: jest.fn() },
  notificationSubscription: { deleteMany: jest.fn() },
  $transaction: jest.fn().mockResolvedValue(undefined),
};

const mockMailService = {
  sendHatAddedEmail: jest.fn().mockResolvedValue(undefined),
  sendOperatorApprovedEmail: jest.fn().mockResolvedValue(undefined),
  sendOperatorSignupInternalEmail: jest.fn().mockResolvedValue(undefined),
};

// WP-D: OB-2A and INT-1 route through the send log now. The mock honours the
// claim-first contract's surface (runs the transport, reports the outcome,
// never throws) so the existing facade assertions keep their meaning.
const mockEmailLogService = {
  claimAndSend: jest.fn(
    async (input: { send: () => Promise<unknown> }): Promise<unknown> => {
      await input.send();
      return { outcome: 'sent', providerMessageId: null };
    },
  ),
};

// WP-H: env-faithful settings mock - resolve() re-reads process.env per
// call (defaults() folds env under the absent stored row), so the suite's
// SALES_EMAIL/ADMIN_EMAIL choreography still steers the INT-1 recipient.
const mockEmailSettingsService = {
  resolve: jest.fn(() => Promise.resolve(EmailSettingsService.defaults())),
  invalidate: jest.fn(),
};

const mockOnboardingEmailsService = {
  sendWelcome: jest.fn(),
  resend: jest.fn(),
};

/** Flush the fire-and-forget promise chains (INT-1 / OB-2A). */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('OperatorsService', () => {
  let service: OperatorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperatorsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        { provide: EmailLogService, useValue: mockEmailLogService },
        { provide: EmailSettingsService, useValue: mockEmailSettingsService },
        {
          provide: OnboardingEmailsService,
          useValue: mockOnboardingEmailsService,
        },
        {
          provide: StaffPermissionsService,
          useValue: { invalidate: jest.fn(), invalidateAll: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OperatorsService>(OperatorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Deleting an operator with history used to reach Postgres, trip over the
  // RESTRICT FKs (bookings/tours/reviews/spotlight) and surface as a bare
  // 500 "Internal server error". The guard must name what blocks the delete
  // and point at deactivation instead.
  describe('remove()', () => {
    const operatorRow = {
      userId: 'user-1',
      user: { role: Role.TOUR_OPERATOR, email: 'op@example.test' },
    };

    it('refuses with a readable 409 naming the blockers when history exists', async () => {
      mockPrismaService.$transaction.mockClear();
      mockPrismaService.operator.findUnique.mockResolvedValueOnce(operatorRow);
      mockPrismaService.tour.count.mockResolvedValueOnce(2);
      mockPrismaService.booking.count.mockResolvedValueOnce(5);
      mockPrismaService.review.count.mockResolvedValueOnce(0);
      mockPrismaService.spotlightRequest.count.mockResolvedValueOnce(0);

      const err: unknown = await service.remove('op-1').catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).message).toContain('2 tours');
      expect((err as ConflictException).message).toContain('5 bookings');
      expect((err as ConflictException).message).toContain('Deactivate');
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('clears the RESTRICT config side-tables and deletes when history is empty', async () => {
      mockPrismaService.$transaction.mockClear();
      mockPrismaService.operator.findUnique.mockResolvedValueOnce(operatorRow);
      mockPrismaService.tour.count.mockResolvedValueOnce(0);
      mockPrismaService.booking.count.mockResolvedValueOnce(0);
      mockPrismaService.review.count.mockResolvedValueOnce(0);
      mockPrismaService.spotlightRequest.count.mockResolvedValueOnce(0);
      mockPrismaService.staffMember.findMany.mockResolvedValueOnce([]);

      const result = await service.remove('op-1');
      expect(result).toEqual({ message: 'Operator deleted successfully' });
      // Incidental config rows (opening a settings tab once) must not make an
      // operator undeletable - they are cleared in the same transaction.
      expect(
        mockPrismaService.operatorSocialMedia.deleteMany,
      ).toHaveBeenCalledWith({ where: { operatorId: 'op-1' } });
      expect(
        mockPrismaService.operatorStripeConfig.deleteMany,
      ).toHaveBeenCalledWith({ where: { operatorId: 'op-1' } });
      expect(
        mockPrismaService.operatorMollieConfig.deleteMany,
      ).toHaveBeenCalledWith({ where: { operatorId: 'op-1' } });
      expect(
        mockPrismaService.notificationSubscription.deleteMany,
      ).toHaveBeenCalledWith({ where: { operatorId: 'op-1' } });
      expect(mockPrismaService.operator.delete).toHaveBeenCalledWith({
        where: { id: 'op-1' },
        select: { id: true },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // Island cascade (client review #10): "operators on this island" = at
  // least one active tour there.
  describe('findAll island filter', () => {
    // The suite's mocks are module-level and never cleared, so each test
    // reads its OWN (last) call, not the first ever recorded.
    const lastFindManyWhere = () =>
      mockPrismaService.operator.findMany.mock.calls.at(-1)?.[0].where;

    it('filters by an active tour on the destination', async () => {
      mockPrismaService.operator.count.mockResolvedValue(0);
      mockPrismaService.operator.findMany.mockResolvedValue([]);
      await service.findAll({ destinationId: 'dest-1' });
      expect(lastFindManyWhere().tours).toEqual({
        some: { destinationId: 'dest-1', isActive: true },
      });
    });

    it('leaves the tours clause off without a destination', async () => {
      mockPrismaService.operator.count.mockResolvedValue(0);
      mockPrismaService.operator.findMany.mockResolvedValue([]);
      await service.findAll({});
      expect(lastFindManyWhere().tours).toBeUndefined();
    });
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

  // ── WP-C: onboarding state machine ──────────────────────────────────────────

  describe('decideVerification', () => {
    const envBefore: Record<string, string | undefined> = {};

    beforeEach(() => {
      jest.clearAllMocks();
      envBefore.ADMIN_EMAIL = process.env.ADMIN_EMAIL;
      envBefore.SALES_EMAIL = process.env.SALES_EMAIL;
      mockPrismaService.operator.findUnique.mockResolvedValue({
        id: 'op1',
        verificationStatus: 'PENDING',
        user: { name: 'Mayra Martina', email: 'mayra@irietours.com' },
        companyInfo: { companyName: 'Irie Tours B.V.' },
      });
      mockPrismaService.operator.updateMany.mockResolvedValue({ count: 1 });
    });

    afterEach(() => {
      for (const key of ['ADMIN_EMAIL', 'SALES_EMAIL'] as const) {
        if (envBefore[key] === undefined) delete process.env[key];
        else process.env[key] = envBefore[key];
      }
    });

    it('approves a PENDING operator through the guarded transition and stamps the decision', async () => {
      await service.decideVerification(
        'op1',
        { decision: 'VERIFIED' },
        'admin-1',
      );

      expect(mockPrismaService.operator.updateMany).toHaveBeenCalledWith({
        where: { id: 'op1', verificationStatus: 'PENDING' },
        data: {
          verificationStatus: 'VERIFIED',
          verificationDecidedAt: expect.any(Date),
        },
      });
    });

    it('fires OB-2A exactly once on approve, to the login mailbox, with wireframe fields', async () => {
      await service.decideVerification(
        'op1',
        { decision: 'VERIFIED' },
        'admin-1',
      );
      await flush();

      expect(mockMailService.sendOperatorApprovedEmail).toHaveBeenCalledTimes(
        1,
      );
      expect(mockMailService.sendOperatorApprovedEmail).toHaveBeenCalledWith(
        'mayra@irietours.com',
        expect.objectContaining({
          firstName: 'Mayra',
          companyName: 'Irie Tours B.V.',
          addTourUrl: expect.stringContaining('/trips/new'),
        }),
      );
      // WP-D (D-19): rerouted through the send log - the guarded transition
      // plus the [templateKey, scopeId] unique are the double one-shot.
      expect(mockEmailLogService.claimAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          templateKey: 'OB2A_APPROVED',
          scopeId: 'op1',
          stream: 'TRANSACTIONAL',
        }),
      );
    });

    it('sends NOTHING on reject', async () => {
      await service.decideVerification(
        'op1',
        { decision: 'REJECTED' },
        'admin-1',
      );
      await flush();

      expect(mockPrismaService.operator.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verificationStatus: 'REJECTED' }),
        }),
      );
      expect(mockMailService.sendOperatorApprovedEmail).not.toHaveBeenCalled();
    });

    it('409s when the guard is lost (already decided / never PENDING), naming the current status', async () => {
      mockPrismaService.operator.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.operator.findUnique.mockResolvedValue({
        id: 'op1',
        verificationStatus: 'VERIFIED',
      });

      await expect(
        service.decideVerification('op1', { decision: 'REJECTED' }, 'admin-1'),
      ).rejects.toThrow(/VERIFIED/);
      await expect(
        service.decideVerification('op1', { decision: 'REJECTED' }, 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockMailService.sendOperatorApprovedEmail).not.toHaveBeenCalled();
    });

    it('two parallel decides produce exactly one winner (decide race)', async () => {
      // The guarded updateMany is the arbiter: first caller flips the row,
      // second sees count 0 - same idiom as the booking hold-expiry flip.
      mockPrismaService.operator.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      mockPrismaService.operator.findUnique.mockResolvedValue({
        id: 'op1',
        verificationStatus: 'VERIFIED',
        user: { name: 'Mayra Martina', email: 'mayra@irietours.com' },
        companyInfo: null,
      });

      const [first, second] = await Promise.allSettled([
        service.decideVerification('op1', { decision: 'VERIFIED' }, 'admin-1'),
        service.decideVerification('op1', { decision: 'VERIFIED' }, 'admin-2'),
      ]);

      expect(first.status).toBe('fulfilled');
      expect(second.status).toBe('rejected');
      await flush();
      expect(mockMailService.sendOperatorApprovedEmail).toHaveBeenCalledTimes(
        1,
      );
    });

    it('404s for an unknown operator', async () => {
      mockPrismaService.operator.findUnique.mockResolvedValue(null);
      await expect(
        service.decideVerification('nope', { decision: 'VERIFIED' }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('a mail failure never fails the approval (fire-and-forget)', async () => {
      mockMailService.sendOperatorApprovedEmail.mockRejectedValueOnce(
        new Error('resend is down'),
      );

      await expect(
        service.decideVerification('op1', { decision: 'VERIFIED' }, 'admin-1'),
      ).resolves.not.toThrow();
      await flush(); // the rejection is caught and logged, never rethrown
    });
  });

  describe('INT-1 recipient resolution (notifyOperatorSignup)', () => {
    type WithNotify = { notifyOperatorSignup(operatorId: string): void };
    const envBefore: Record<string, string | undefined> = {};

    beforeEach(() => {
      jest.clearAllMocks();
      envBefore.ADMIN_EMAIL = process.env.ADMIN_EMAIL;
      envBefore.SALES_EMAIL = process.env.SALES_EMAIL;
      mockPrismaService.operator.findUnique.mockResolvedValue({
        createdAt: new Date('2026-07-09T18:32:00.000Z'),
        contactPhone: '+599 9 561 22 43',
        user: { name: 'Mayra Martina', email: 'mayra@irietours.com' },
        companyInfo: { companyName: 'Irie Tours B.V.', companyPhone: null },
      });
    });

    afterEach(() => {
      for (const key of ['ADMIN_EMAIL', 'SALES_EMAIL'] as const) {
        if (envBefore[key] === undefined) delete process.env[key];
        else process.env[key] = envBefore[key];
      }
    });

    it('prefers SALES_EMAIL when set', async () => {
      process.env.SALES_EMAIL = 'sales@island.tours';
      process.env.ADMIN_EMAIL = 'reviewer@island.tours';

      (service as unknown as WithNotify).notifyOperatorSignup('op1');
      await flush();

      expect(
        mockMailService.sendOperatorSignupInternalEmail,
      ).toHaveBeenCalledWith(
        'sales@island.tours',
        expect.objectContaining({
          operatorName: 'Irie Tours B.V.',
          signatoryName: 'Mayra Martina',
          email: 'mayra@irietours.com',
          phone: '+599 9 561 22 43',
          reviewUrl: expect.stringContaining('/tour-operators/op1/edit'),
        }),
      );
    });

    it('falls back to ADMIN_EMAIL when SALES_EMAIL is unset', async () => {
      delete process.env.SALES_EMAIL;
      process.env.ADMIN_EMAIL = 'reviewer@island.tours';

      (service as unknown as WithNotify).notifyOperatorSignup('op1');
      await flush();

      expect(
        mockMailService.sendOperatorSignupInternalEmail,
      ).toHaveBeenCalledWith('reviewer@island.tours', expect.anything());
    });

    it('logs and skips when neither mailbox is configured (never throws)', async () => {
      delete process.env.SALES_EMAIL;
      delete process.env.ADMIN_EMAIL;

      (service as unknown as WithNotify).notifyOperatorSignup('op1');
      await flush();

      expect(
        mockMailService.sendOperatorSignupInternalEmail,
      ).not.toHaveBeenCalled();
      // No recipient -> no query either: the skip happens before any I/O.
      expect(mockPrismaService.operator.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('create() onboarding hooks', () => {
    const envBefore: Record<string, string | undefined> = {};

    beforeEach(() => {
      jest.clearAllMocks();
      envBefore.SALES_EMAIL = process.env.SALES_EMAIL;
      envBefore.ADMIN_EMAIL = process.env.ADMIN_EMAIL;
      process.env.SALES_EMAIL = 'sales@island.tours';

      // No pre-existing account for the invited email.
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.operator.create.mockResolvedValue({
        id: 'op-new',
        userId: 'user-new',
        isActive: true,
        verificationStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.staffMember.create.mockResolvedValue({ id: 'seat-1' });
      mockPrismaService.staffDesignation.createMany.mockResolvedValue({
        count: 3,
      });
      // INT-1 loads its own recipient data after the commit.
      mockPrismaService.operator.findUnique.mockResolvedValue({
        createdAt: new Date(),
        contactPhone: null,
        user: { name: 'Mayra Martina', email: 'mayra@irietours.com' },
        companyInfo: null,
      });
    });

    afterEach(() => {
      for (const key of ['ADMIN_EMAIL', 'SALES_EMAIL'] as const) {
        if (envBefore[key] === undefined) delete process.env[key];
        else process.env[key] = envBefore[key];
      }
    });

    it('creates the operator row PENDING (accepted), not UNVERIFIED', async () => {
      await service.create({
        name: 'Mayra Martina',
        email: 'mayra@irietours.com',
      });

      expect(mockPrismaService.operator.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verificationStatus: 'PENDING' }),
        }),
      );
    });

    it('fires INT-1 to the sales recipient after the account is committed', async () => {
      await service.create({
        name: 'Mayra Martina',
        email: 'mayra@irietours.com',
      });
      await flush();

      expect(
        mockMailService.sendOperatorSignupInternalEmail,
      ).toHaveBeenCalledWith(
        'sales@island.tours',
        expect.objectContaining({ signatoryName: 'Mayra Martina' }),
      );
      // WP-D: INT-1 rides the send log now (scope = the new operator id).
      expect(mockEmailLogService.claimAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          templateKey: 'INT1_NEW_OPERATOR',
          scopeId: 'op-new',
          stream: 'INTERNAL',
        }),
      );
    });

    it('fires the OB-2 welcome alongside INT-1 (WP-D, D-08)', async () => {
      await service.create({
        name: 'Mayra Martina',
        email: 'mayra@irietours.com',
      });
      await flush();

      expect(mockOnboardingEmailsService.sendWelcome).toHaveBeenCalledWith(
        'op-new',
      );
    });
  });
});
