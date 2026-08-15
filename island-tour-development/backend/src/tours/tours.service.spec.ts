/**
 * Unit tests for ToursService (V2 §4/§5: multi-category, multi-hub, flat tour URLs).
 *
 * PrismaService is fully mocked. $transaction invokes its callback with the same
 * mock so transactional and non-transactional calls hit the same jest.fn() stubs.
 *
 * Covers: resolveOperatorId, assertOwnership, resolveUniqueSlug, create (multi-category
 * validation + primary + per-hub allowed-category + always-flat slug_registry),
 * findAll (join filters), findBySlug (flat), publish guards, pause/unpause, archive,
 * restore, remove, and update (category/hub replacement + primary re-point).
 */

import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BandParticipation,
  DepartureStatus,
  PickupModel,
  PricingModel,
  Role,
  SlugEntityType,
  TourApprovalStatus,
  TourStatus,
  WholeUnitType,
} from '@prisma/client';
import { CreateTourDto, SearchSort, UpdateTourDto } from './dto/tour.dto';
import { AvailabilityService } from '@/availability/availability.service';
import { FxRatesService } from '@/fx/fx-rates.service';
import { InboxService } from '@/inbox/inbox.service';
import { MailService } from '@/mail/mail.service';
import { EmailSettingsService } from '@/mail/email-settings.service';
import { ToursService } from './tours.service';
import { TourPendingChangesService } from './tour-pending-changes.service';

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMockPrismaService() {
  const mock = {
    operator: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      // publish() stamps firstTourLiveAt one-shot; default "already stamped"
      // so pre-existing publish tests exercise publishing, not onboarding.
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    outboxEvent: { create: jest.fn() },
    // Seat-aware operator resolution (common/utils/operator.util.ts) checks
    // team seats when no direct Operator.userId row matches.
    staffMember: { findUnique: jest.fn() },
    destination: { findUnique: jest.fn(), findMany: jest.fn() },
    category: { findUnique: jest.fn(), findMany: jest.fn() },
    hub: { findUnique: jest.fn() },
    hubAllowedCategory: { findUnique: jest.fn(), count: jest.fn() },
    attributeDefinition: { findMany: jest.fn() },
    tourAttribute: { findMany: jest.fn() },
    // Accent-insensitive term matching runs in raw SQL (Postgres has no
    // accent-folding operator). Default: every tour matches, so tests that are
    // not about matching keep asserting the rest of the where-clause.
    $queryRaw: jest.fn().mockResolvedValue([{ id: 't-1' }]),
    tour: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    tourCategory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tourHub: { deleteMany: jest.fn(), createMany: jest.fn() },
    tourAgeBand: { findMany: jest.fn(), findFirst: jest.fn() },
    departure: { findMany: jest.fn() },
    // The two non-cascade Tour relations: remove() refuses while either holds
    // rows. Default 0 so existing delete tests keep passing.
    booking: { count: jest.fn().mockResolvedValue(0) },
    review: { count: jest.fn().mockResolvedValue(0) },
    slugRegistry: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    slugRedirect: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) =>
    fn(mock),
  );
  return mock;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTour(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tour-1',
    name: 'Sunset Catamaran Cruise',
    slug: 'sunset-catamaran-cruise',
    status: TourStatus.DRAFT,
    operatorId: 'op-1',
    destinationId: 'dest-1',
    pricingModel: PricingModel.PER_PERSON,
    wholeUnitType: null,
    basePrice: '75.00',
    priceFrom: null,
    durationMinutesFrom: 180,
    pickupModel: PickupModel.NONE,
    maxPartySize: 20,
    minPartySize: 1,
    bookingCutoffMinutes: 120,
    cancellationHours: 24,
    // Approval workflow (conflict #1): default fixtures are APPROVED so the
    // pre-existing publish/readiness tests exercise the readiness bar, not
    // the approval gate (which has its own describe).
    approvalStatus: TourApprovalStatus.APPROVED,
    submittedAt: null,
    reviewNote: null,
    h1Override: null,
    breadcrumbLabel: null,
    aggregateRating: null,
    aggregateReviewCount: 0,
    isSponsored: false,
    isActive: true,
    publishedAt: null,
    firstPublishedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    categories: [{ categoryId: 'cat-1', isPrimary: true }],
    hubs: [],
    translations: [],
    highlights: [],
    operator: {
      companyInfo: { companyName: 'Miss Ann' },
      user: { name: 'Op Owner' },
    },
    ...overrides,
  };
}

// Deliberately the MINIMUM body: the creation wizard mints a draft from four
// answers and asks everything else later, so anything this fixture carries that
// the wizard does not send is a requirement no create call can satisfy.
const baseCreateDto: CreateTourDto = {
  name: 'Sunset Catamaran Cruise',
  destinationId: 'dest-1',
  categoryIds: ['cat-1'],
  pricingModel: PricingModel.PER_PERSON,
  pickupModel: PickupModel.NONE,
};

describe('ToursService', () => {
  let service: ToursService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  let availability: {
    computeIsBookable: jest.Mock;
    resyncTourAvailability: jest.Mock;
    nextBookableDateByTour: jest.Mock;
  };

  let mail: {
    sendTourSubmittedForReviewEmail: jest.Mock;
    sendTourSubmittedSalesEmail: jest.Mock;
    sendTourChangesRequestedEmail: jest.Mock;
    sendTourApprovedEmail: jest.Mock;
  };

  let pendingChanges: {
    isGated: jest.Mock;
    setStashedName: jest.Mock;
    getLatestForTour: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    pendingChanges = {
      // Real predicate shape so the update() gate tests exercise the actual
      // branch: LIVE + non-platform is gated.
      isGated: jest.fn(
        (status: TourStatus, role: Role) =>
          status === TourStatus.LIVE &&
          role !== Role.ADMIN &&
          role !== Role.STAFF &&
          role !== Role.EDITOR,
      ),
      setStashedName: jest.fn().mockResolvedValue(null),
      getLatestForTour: jest.fn().mockResolvedValue(null),
    };
    availability = {
      computeIsBookable: jest.fn().mockResolvedValue(true),
      resyncTourAvailability: jest.fn().mockResolvedValue(undefined),
      // Dead-end alternatives: default to "nothing has room" so a test must
      // opt IN to availability rather than inherit it.
      nextBookableDateByTour: jest.fn().mockResolvedValue(new Map()),
    };
    mail = {
      sendTourSubmittedForReviewEmail: jest.fn().mockResolvedValue(undefined),
      sendTourSubmittedSalesEmail: jest.fn().mockResolvedValue(undefined),
      sendTourChangesRequestedEmail: jest.fn().mockResolvedValue(undefined),
      sendTourApprovedEmail: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToursService,
        { provide: PrismaService, useValue: prisma },
        { provide: AvailabilityService, useValue: availability },
        { provide: MailService, useValue: mail },
        {
          provide: EmailSettingsService,
          // WP-H: env-faithful - the INT-2 tests' SALES_EMAIL env choreography
          // still steers the resolved sales recipient.
          useValue: {
            resolve: jest.fn(() =>
              Promise.resolve(EmailSettingsService.defaults()),
            ),
            invalidate: jest.fn(),
          },
        },
        { provide: InboxService, useValue: { notify: jest.fn() } },
        { provide: TourPendingChangesService, useValue: pendingChanges },
        {
          provide: FxRatesService,
          // No conversion in unit tests (no ?currency) -> money falls back to source.
          useValue: {
            getDisplayRate: jest.fn().mockResolvedValue(null),
            attachMoney: jest.fn().mockResolvedValue(undefined),
            // The detail path uses this one - it also converts the child retail
            // amounts (bands, add-ons, pickup zones) the booking widget prices
            // from.
            attachDetailMoney: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    service = module.get(ToursService);
    jest.clearAllMocks();
    // Listing card-attribute resolver (loadCardAttributes) defaults - individual
    // tests override as needed.
    prisma.tourAttribute.findMany.mockResolvedValue([]);
    prisma.attributeDefinition.findMany.mockResolvedValue([]);
  });

  // ── resolveOperatorId (exercised via create / findMyTours) ────────────────────

  describe('resolveOperatorId', () => {
    it('throws 400 when a TOUR_OPERATOR has no operator profile', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);
      await expect(
        service.create(baseCreateDto, 'user-x', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-provisions an operator profile for ADMIN', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);
      prisma.operator.create.mockResolvedValue({ id: 'op-admin' });
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
        timezone: 'America/Curacao',
      });
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.tour.create.mockResolvedValue(
        makeTour({ operatorId: 'op-admin' }),
      );
      prisma.slugRegistry.create.mockResolvedValue({});

      await service.create(baseCreateDto, 'admin-user', Role.ADMIN);
      expect(prisma.operator.create).toHaveBeenCalledWith({
        data: { userId: 'admin-user' },
        select: { id: true },
      });
    });
  });

  // ── findMyTours scope (test report 2026-08-01 §Admin.4) ──────────────────────

  describe('findMyTours - who gets whose catalogue', () => {
    beforeEach(() => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
    });

    // The regression: platform staff have no operator record, so resolution
    // threw and the dashboard's Tours screen came back empty for them.
    it.each([
      ['STAFF', Role.STAFF],
      ['EDITOR', Role.EDITOR],
      ['ADMIN', Role.ADMIN],
    ])(
      'lists the whole catalogue for %s, resolving no operator',
      async (_label, role) => {
        await service.findMyTours('platform-user', role, {});

        expect(prisma.tour.findMany.mock.calls[0][0].where).toEqual({});
        // Never routed through resolution - that is what used to throw, and for
        // ADMIN it would silently auto-provision a junk operator record.
        expect(prisma.operator.findUnique).not.toHaveBeenCalled();
        expect(prisma.operator.create).not.toHaveBeenCalled();
      },
    );

    it('still scopes a TOUR_OPERATOR to their own tours', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await service.findMyTours('operator-user', Role.TOUR_OPERATOR, {});

      expect(prisma.tour.findMany.mock.calls[0][0].where).toEqual({
        operatorId: 'op-1',
      });
    });

    // The dashboard's status dropdown has sent approvalStatus=PENDING/REJECTED
    // since 2026-08-02; without the DTO field the WHOLE request 400s
    // (forbidNonWhitelisted) and the "In review" filter looked slow, then
    // empty (the client retried a 400 three times).
    it('filters my-tours on the approvalStatus axis, independent of status', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await service.findMyTours('operator-user', Role.TOUR_OPERATOR, {
        approvalStatus: TourApprovalStatus.PENDING,
      });

      expect(prisma.tour.findMany.mock.calls.at(-1)?.[0].where).toEqual({
        operatorId: 'op-1',
        approvalStatus: 'PENDING',
      });
    });

    it('filters the admin list on approvalStatus, ANDed with status', async () => {
      await service.findAllAdmin({
        status: TourStatus.PAUSED,
        approvalStatus: TourApprovalStatus.REJECTED,
      });

      expect(prisma.tour.findMany.mock.calls.at(-1)?.[0].where).toEqual({
        status: 'PAUSED',
        approvalStatus: 'REJECTED',
      });
    });

    // Client 2026-08-15: the admin Tours list is the working catalogue -
    // tours inside the review loop live on the Submissions queue instead.
    it('the admin list excludes in-review and changes-requested tours by default', async () => {
      await service.findAllAdmin({});

      expect(prisma.tour.findMany.mock.calls.at(-1)?.[0].where).toEqual({
        approvalStatus: { notIn: ['PENDING', 'REJECTED'] },
      });
    });

    it("reviewLoop=true is the queue's All view - both review states at once", async () => {
      await service.findAllAdmin({
        reviewLoop: true,
        sortBy: 'submittedAt',
        sortDir: 'asc',
      });

      const call = prisma.tour.findMany.mock.calls.at(-1)?.[0];
      expect(call.where).toEqual({
        approvalStatus: { in: ['PENDING', 'REJECTED'] },
      });
      // FIFO for reviewers.
      expect(call.orderBy).toEqual({ submittedAt: 'asc' });
    });

    it("approvalStatus=ANY skips the review axis - the command palette's jump-to-anything scope", async () => {
      await service.findAllAdmin({ approvalStatus: 'ANY' });

      expect(prisma.tour.findMany.mock.calls.at(-1)?.[0].where).toEqual({});
    });

    it('still 400s a TOUR_OPERATOR with no operator profile', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);
      prisma.staffMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findMyTours('user-x', Role.TOUR_OPERATOR, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── resolveUniqueSlug (via create) ────────────────────────────────────────────

  describe('create - slug resolution', () => {
    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
        timezone: 'America/Curacao',
      });
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.create.mockResolvedValue(makeTour());
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    // Client review #16/#17: a sub-category is a valid TAG but never the
    // PRIMARY (no page -> 404 breadcrumb). Enforced server-side, not just by
    // the dashboard hiding sub-categories from the select.
    it('rejects a sub-category as the primary on create', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-sub', parentCategoryId: 'cat-1' },
      ]);
      await expect(
        service.create(
          { ...baseCreateDto, categoryIds: ['cat-sub'] },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(/top-level/);
      expect(prisma.tour.create).not.toHaveBeenCalled();
    });

    it('accepts a sub-category as a NON-primary tag on create', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', parentCategoryId: null },
        { id: 'cat-sub', parentCategoryId: 'cat-1' },
      ]);
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      await service.create(
        {
          ...baseCreateDto,
          categoryIds: ['cat-1', 'cat-sub'],
          primaryCategoryId: 'cat-1',
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(prisma.tour.create).toHaveBeenCalled();
    });

    // Review #17 verbatim: the sub-type is validated against the tour's OWN
    // categories - an orphan sub (parent absent from the tour) is rejected.
    it('rejects a sub-category tag whose parent is not on the tour (create)', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-other', parentCategoryId: null },
        { id: 'cat-sub', parentCategoryId: 'cat-1' },
      ]);
      await expect(
        service.create(
          {
            ...baseCreateDto,
            categoryIds: ['cat-other', 'cat-sub'],
            primaryCategoryId: 'cat-other',
          },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(/parent category on the same tour/);
      expect(prisma.tour.create).not.toHaveBeenCalled();
    });

    it('rejects an orphan sub-category tag on update', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-other', parentCategoryId: null },
        { id: 'cat-sub', parentCategoryId: 'cat-1' },
      ]);
      await expect(
        service.update(
          'tour-1',
          { categoryIds: ['cat-other', 'cat-sub'] },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(/parent category on the same tour/);
    });

    // The third door (security review #78): primaryCategoryId sent ALONE
    // re-points the primary through its own branch and must hit the same rule.
    it('rejects a sub-category as the primary when sent alone', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tourCategory.findUnique.mockResolvedValue({
        id: 'link-1',
        category: { parentCategoryId: 'cat-1' },
      });
      await expect(
        service.update(
          'tour-1',
          { primaryCategoryId: 'cat-sub' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(/top-level/);
      expect(prisma.tourCategory.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a sub-category as the primary on update', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-sub', parentCategoryId: 'cat-1' },
      ]);
      await expect(
        service.update(
          'tour-1',
          { categoryIds: ['cat-sub'] },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(/top-level/);
    });

    // Client review #12 / master 2.3: the slug is a destination-registry
    // entry set by Island Tours - an operator's slug is ignored (never an
    // error) and the address derives from the name.
    it('ignores an operator-supplied slug - the address derives from the name', async () => {
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);

      await service.create(
        { ...baseCreateDto, slug: 'my-custom-slug' },
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'sunset-catamaran-cruise' }),
        }),
      );
    });

    it('honours an ADMIN-supplied slug', async () => {
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);

      await service.create(
        { ...baseCreateDto, slug: 'admin-chosen-slug' },
        'admin',
        Role.ADMIN,
      );
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'admin-chosen-slug' }),
        }),
      );
    });

    it('uses the base slug when nothing conflicts', async () => {
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);

      await service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR);
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'sunset-catamaran-cruise' }),
        }),
      );
    });

    it('appends the operator name when the slug is taken by another entity', async () => {
      // own-conflict check (false), then base conflict via registry, then candidate free
      prisma.tour.findFirst
        .mockResolvedValueOnce(null) // ownConflict
        .mockResolvedValueOnce(null) // base tour conflict
        .mockResolvedValueOnce(null); // candidate tour
      prisma.slugRegistry.findUnique
        .mockResolvedValueOnce({ id: 'reg-1' }) // base registry conflict
        .mockResolvedValueOnce(null); // candidate registry free
      prisma.operator.findUnique.mockResolvedValue({
        id: 'op-1',
        companyInfo: { companyName: 'Bluefin Charters' },
        user: { name: 'Bob' },
      });

      await service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR);
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'sunset-catamaran-cruise-bluefin-charters',
          }),
        }),
      );
    });

    it('throws 409 when the same operator already owns the slug', async () => {
      prisma.tour.findFirst.mockResolvedValueOnce({ id: 'existing' }); // ownConflict
      await expect(
        service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 409 (never appends a number) when both base and operator-name slug are taken', async () => {
      prisma.tour.findFirst
        .mockResolvedValueOnce(null) // ownConflict
        .mockResolvedValueOnce(null) // base tour conflict
        .mockResolvedValueOnce(null); // candidate tour
      prisma.slugRegistry.findUnique
        .mockResolvedValueOnce({ id: 'reg-1' }) // base registry conflict
        .mockResolvedValueOnce({ id: 'reg-2' }); // candidate registry also taken
      prisma.operator.findUnique.mockResolvedValue({
        id: 'op-1',
        companyInfo: { companyName: 'Bluefin Charters' },
        user: { name: 'Bob' },
      });

      await expect(
        service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
      expect(prisma.tour.create).not.toHaveBeenCalled();
    });
  });

  // ── create - validation + many-to-many ────────────────────────────────────────

  describe('create - categories & hubs', () => {
    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
        timezone: 'America/Curacao',
      });
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.tour.create.mockResolvedValue(makeTour());
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    it('rejects when the destination is missing or inactive', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);
      await expect(
        service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when a category is missing or inactive', async () => {
      prisma.category.findMany.mockResolvedValue([]); // none active
      await expect(
        service.create(
          { ...baseCreateDto, categoryIds: ['cat-1'] },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when primaryCategoryId is not one of categoryIds', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      await expect(
        service.create(
          {
            ...baseCreateDto,
            categoryIds: ['cat-1', 'cat-2'],
            primaryCategoryId: 'cat-9',
          },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates join rows with the first category primary by default and always writes a TOUR slug_registry row', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      await service.create(
        { ...baseCreateDto, categoryIds: ['cat-1', 'cat-2'] },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categories: {
              create: [
                { categoryId: 'cat-1', isPrimary: true },
                { categoryId: 'cat-2', isPrimary: false },
              ],
            },
            hubs: { create: [] },
          }),
        }),
      );
      expect(prisma.slugRegistry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ entityType: SlugEntityType.TOUR }),
        }),
      );
    });

    it('honours an explicit primaryCategoryId', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      await service.create(
        {
          ...baseCreateDto,
          categoryIds: ['cat-1', 'cat-2'],
          primaryCategoryId: 'cat-2',
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categories: {
              create: [
                { categoryId: 'cat-1', isPrimary: false },
                { categoryId: 'cat-2', isPrimary: true },
              ],
            },
          }),
        }),
      );
    });

    it('validates each hub belongs to the destination and allows at least one of the categories', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.hub.findUnique.mockResolvedValue({
        id: 'hub-1',
        name: 'Playa Piscado',
        destinationId: 'dest-1',
        isActive: true,
        allowedCategories: [{ category: { id: 'cat-1', name: 'Boat Tours' } }],
      });

      await service.create(
        { ...baseCreateDto, hubIds: ['hub-1'] },
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hubs: { create: [{ hubId: 'hub-1' }] },
          }),
        }),
      );
    });

    it('rejects a hub from a different destination', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.hub.findUnique.mockResolvedValue({
        id: 'hub-1',
        name: 'Wrong Island Hub',
        destinationId: 'dest-OTHER',
        isActive: true,
        allowedCategories: [{ category: { id: 'cat-1', name: 'Boat Tours' } }],
      });
      await expect(
        service.create(
          { ...baseCreateDto, hubIds: ['hub-1'] },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a hub when none of the tour categories are allowed', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Boat Tours' },
      ]);
      prisma.hub.findUnique.mockResolvedValue({
        id: 'hub-1',
        name: 'Snorkel Bay',
        destinationId: 'dest-1',
        isActive: true,
        allowedCategories: [{ category: { id: 'cat-OTHER', name: 'Diving' } }],
      });
      await expect(
        service.create(
          { ...baseCreateDto, hubIds: ['hub-1'] },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('flattens the response to categoryIds / primaryCategoryId / hubIds', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.create.mockResolvedValue(
        makeTour({
          categories: [{ categoryId: 'cat-1', isPrimary: true }],
          hubs: [{ hubId: 'hub-1' }],
        }),
      );
      const result: any = await service.create(
        baseCreateDto,
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(result.categoryIds).toEqual(['cat-1']);
      expect(result.primaryCategoryId).toBe('cat-1');
      expect(result.hubIds).toEqual(['hub-1']);
      expect(result).not.toHaveProperty('categories');
    });
  });

  // ── create - pricing model (UNIT vs PER_PERSON unit-field isolation) ─────────

  describe('create - pricing model', () => {
    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
        timezone: 'America/Curacao',
      });
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.tour.create.mockResolvedValue(makeTour());
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    it('nulls out wholeUnitType/unitIncludedGuests/extraPersonPrice for a PER_PERSON tour, even when supplied', async () => {
      await service.create(
        {
          ...baseCreateDto,
          pricingModel: PricingModel.PER_PERSON,
          wholeUnitType: WholeUnitType.BOAT,
          unitIncludedGuests: 4,
          extraPersonPrice: '10.00',
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.PER_PERSON,
            wholeUnitType: null,
            unitIncludedGuests: null,
            extraPersonPrice: null,
          }),
        }),
      );
    });

    it('passes the surcharge fields through for a GROUP unit tour', async () => {
      await service.create(
        {
          ...baseCreateDto,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.GROUP,
          unitIncludedGuests: 4,
          extraPersonPrice: '10.00',
          basePrice: '500.00',
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.UNIT,
            wholeUnitType: WholeUnitType.GROUP,
            unitIncludedGuests: 4,
            extraPersonPrice: '10.00',
          }),
        }),
      );
    });

    it('nulls the surcharge fields for a non-GROUP unit tour (flat whole-unit price)', async () => {
      await service.create(
        {
          ...baseCreateDto,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.BOAT,
          unitIncludedGuests: 4,
          extraPersonPrice: '10.00',
          basePrice: '500.00',
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.UNIT,
            wholeUnitType: WholeUnitType.BOAT,
            unitIncludedGuests: null,
            extraPersonPrice: null,
          }),
        }),
      );
    });
  });

  // ── Party size / meeting point (cross-field guards) ───────────────────────────

  describe('cross-field guards', () => {
    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
        timezone: 'America/Curacao',
      });
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.tour.create.mockResolvedValue(makeTour());
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    // The column is NOT NULL, but requiring it in the CREATE body broke the
    // only caller that mints a row: the wizard's first step asks four questions
    // and asks for capacity two steps later.
    it('creates without a maxPartySize, leaving the schema default to write it', async () => {
      await service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR);

      const data = prisma.tour.create.mock.calls[0][0].data as {
        maxPartySize?: number;
      };
      expect(data.maxPartySize).toBeUndefined();
    });

    it('rejects a create whose minimum exceeds the (defaulted) maximum', async () => {
      await expect(
        service.create(
          { ...baseCreateDto, minPartySize: 12 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // Either end can arrive on its own, so the guard compares against the
    // STORED value - not just against a sibling in the same body.
    it('rejects a maximum sent below the stored minimum', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ minPartySize: 8, maxPartySize: 20 }),
      );

      await expect(
        service.update('tour-1', { maxPartySize: 4 }, 'admin', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a minimum sent above the stored maximum', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ minPartySize: 1, maxPartySize: 6 }),
      );

      await expect(
        service.update('tour-1', { minPartySize: 10 }, 'admin', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    // Half a meeting point cannot be plotted anywhere, so it is data no reader
    // can use. The wizard guards it too; this is the other side of the wire.
    it('rejects a latitude sent without a longitude', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ meetingPointLat: null, meetingPointLng: null }),
      );

      await expect(
        service.update(
          'tour-1',
          { meetingPointLat: 12.1 },
          'admin',
          Role.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a longitude alone when the tour already has a latitude', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ meetingPointLat: 12.1, meetingPointLng: null }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await expect(
        service.update(
          'tour-1',
          { meetingPointLng: -68.9 },
          'admin',
          Role.ADMIN,
        ),
      ).resolves.toBeDefined();
    });

    it('accepts a widening pair sent together', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ minPartySize: 1, maxPartySize: 6 }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(
        makeTour({ minPartySize: 10, maxPartySize: 30 }),
      );

      await expect(
        service.update(
          'tour-1',
          { minPartySize: 10, maxPartySize: 30 },
          'admin',
          Role.ADMIN,
        ),
      ).resolves.toBeDefined();
    });
  });

  // ── findAll - join filters ─────────────────────────────────────────────────────

  describe('findAll', () => {
    /**
     * Pins "now" for the date-anchored tests below.
     *
     * `findAll`'s date filter runs the real live-bookability rule, which drops
     * departures already past their booking cutoff - measured against the
     * actual clock. The fixtures use a FIXED calendar date, so each of these
     * tests silently rots the moment that date slides into the past: the
     * 09:00 case started failing on 2026-07-20 (its departure went by at 13:00
     * UTC) and the 18:00 case was hours from doing the same. Freezing the
     * clock is what makes them assert the capacity/bucket logic they are
     * actually about, rather than the calendar.
     */
    const freezeClock = () =>
      jest.useFakeTimers({
        now: new Date('2026-07-19T12:00:00.000Z'),
        // Only Date is faked: the suite awaits real promises, and faking the
        // timer queue would stall them.
        doNotFake: [
          'setTimeout',
          'setInterval',
          'setImmediate',
          'nextTick',
          'queueMicrotask',
        ],
      });

    // Unconditional, so a frozen clock never leaks into a later test even if
    // the one that froze it threw.
    afterEach(() => jest.useRealTimers());

    it('filters category/hub via the join relations and flattens results', async () => {
      prisma.tour.count.mockResolvedValue(1);
      prisma.tour.findMany.mockResolvedValue([
        makeTour({
          images: [],
          categories: [{ categoryId: 'cat-1', isPrimary: true }],
          hubs: [],
        }),
      ]);

      const result = await service.findAll({
        categoryId: 'cat-1',
        hubId: 'hub-1',
        page: 1,
        limit: 20,
      });
      expect(prisma.tour.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categories: { some: { categoryId: 'cat-1' } },
            hubs: { some: { hubId: 'hub-1' } },
            status: TourStatus.LIVE,
            isActive: true,
          }),
        }),
      );
      expect(result.data[0].categoryIds).toEqual(['cat-1']);
    });

    it('applies duration/rating filters and the requested sort', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({
        durationMin: 60,
        durationMax: 480,
        ratingMin: 4,
        sort: 'price_asc',
        page: 1,
        limit: 20,
      } as any);
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.durationMinutesFrom).toEqual({ gte: 60, lte: 480 });
      expect(call.where.aggregateRating).toEqual({ gte: 4 });
      expect(call.orderBy).toEqual([
        { priceFrom: { sort: 'asc', nulls: 'last' } },
        { basePrice: 'asc' },
      ]);
    });

    it('filters on priceFrom (the "From $X" display anchor), not basePrice, when minPrice/maxPrice are given', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({
        minPrice: 50,
        maxPrice: 200,
        page: 1,
        limit: 20,
      });

      const findManyCall = prisma.tour.findMany.mock.calls[0][0];
      expect(findManyCall.where.priceFrom).toEqual({ gte: 50, lte: 200 });
      expect(findManyCall.where.basePrice).toBeUndefined();

      const countCall = prisma.tour.count.mock.calls[0][0];
      expect(countCall.where.priceFrom).toEqual({ gte: 50, lte: 200 });
    });

    it('defaults to the Recommended sort (spotlight first, then tierRank → quality → id)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 20 });
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual([
        { isSponsored: 'desc' },
        { tierRank: 'asc' },
        { qualityScore: 'desc' },
        { id: 'asc' },
      ]);
    });

    it('builds AND-ed attribute filters from raw query params (dictionary keys only)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      prisma.attributeDefinition.findMany.mockResolvedValue([
        { key: 'boat_type' },
      ]); // 'nope' not in dict
      await service.findAll(
        { page: 1, limit: 20 },
        {
          boat_type: 'catamaran,yacht',
          nope: 'x',
        },
      );
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.AND).toEqual([
        {
          attributes: {
            some: {
              attributeKey: 'boat_type',
              OR: [
                { attributeValue: 'catamaran' },
                { attributeValue: { contains: '"catamaran"' } },
                { attributeValue: 'yacht' },
                { attributeValue: { contains: '"yacht"' } },
              ],
            },
          },
        },
      ]);
    });

    // ── Phase 2: cheap params ─────────────────────────────────────────────────

    it('filters multi-category via `in` (categoryIds takes precedence over categoryId)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({
        categoryId: 'cat-single',
        categoryIds: ['cat-a', 'cat-b'],
        page: 1,
        limit: 20,
      });
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.categories).toEqual({
        some: { categoryId: { in: ['cat-a', 'cat-b'] } },
      });
    });

    it('filters by free-cancellation ceiling and pickup availability', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({
        cancellationMaxHours: 24,
        pickupAvailable: true,
        page: 1,
        limit: 20,
      });
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.cancellationHours).toEqual({ lte: 24 });
      expect(call.where.pickupModel).toEqual({ not: PickupModel.NONE });
    });

    it('does NOT apply pickup filter when pickupAvailable is falsey', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 20 });
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.pickupModel).toBeUndefined();
    });

    // ── Phase 3: date-anchored availability ───────────────────────────────────

    it('date filter keeps only tours with a fitting OPEN departure (capacity math)', async () => {
      freezeClock();
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      // t-ok has 3 seats left (>= 2); t-full has 1 seat left (< 2) -> excluded.
      prisma.departure.findMany.mockResolvedValue([
        {
          tourId: 't-ok',
          capacity: 10,
          bookedCount: 7,
          date: new Date('2026-07-20T00:00:00.000Z'),
          startTime: new Date('1970-01-01T09:00:00.000Z'),
          status: DepartureStatus.OPEN,
          tour: { timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
        },
        {
          tourId: 't-full',
          capacity: 10,
          bookedCount: 9,
          date: new Date('2026-07-20T00:00:00.000Z'),
          startTime: new Date('1970-01-01T09:00:00.000Z'),
          status: DepartureStatus.OPEN,
          tour: { timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
        },
      ]);

      await service.findAll({
        destinationId: 'dest-1',
        date: '2026-07-20',
        guests: 2,
        page: 1,
        limit: 20,
      });

      const depCall = prisma.departure.findMany.mock.calls[0][0];
      expect(depCall.where).toEqual(
        expect.objectContaining({
          date: new Date('2026-07-20T00:00:00.000Z'),
          status: DepartureStatus.OPEN,
          tour: { destinationId: 'dest-1' },
        }),
      );
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.id).toEqual({ in: ['t-ok'] });
    });

    it('date filter narrows by time-of-day bucket (evening excludes a morning departure)', async () => {
      freezeClock();
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      prisma.departure.findMany.mockResolvedValue([
        {
          tourId: 't-morning',
          capacity: 10,
          bookedCount: 0,
          date: new Date('2026-07-20T00:00:00.000Z'),
          startTime: new Date('1970-01-01T09:00:00.000Z'), // 09:00 -> morning
          status: DepartureStatus.OPEN,
          tour: { timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
        },
        {
          tourId: 't-evening',
          capacity: 10,
          bookedCount: 0,
          date: new Date('2026-07-20T00:00:00.000Z'),
          startTime: new Date('1970-01-01T18:00:00.000Z'), // 18:00 -> evening
          status: DepartureStatus.OPEN,
          tour: { timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
        },
      ]);

      await service.findAll({
        date: '2026-07-20',
        guests: 1,
        timeOfDay: ['evening'],
        page: 1,
        limit: 20,
      });

      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.id).toEqual({ in: ['t-evening'] });
    });

    it('date with no availability yields an empty id set (zero results)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      prisma.departure.findMany.mockResolvedValue([]);

      await service.findAll({
        date: '2026-07-20',
        guests: 4,
        page: 1,
        limit: 20,
      });

      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.id).toEqual({ in: [] });
    });

    it('ignores guests/timeOfDay when no date is provided (no departure query)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({
        guests: 4,
        timeOfDay: ['morning'],
        page: 1,
        limit: 20,
      });
      expect(prisma.departure.findMany).not.toHaveBeenCalled();
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.id).toBeUndefined();
    });
  });

  // ── search ────────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('short-circuits (no DB query) for terms under 2 chars', async () => {
      const res = await service.search({ q: 'a' });
      expect(res.data).toEqual([]);
      expect(res.total).toBe(0);
      expect(prisma.tour.findMany).not.toHaveBeenCalled();
    });

    it('searches across name/translations/category/hub/highlights and flattens results', async () => {
      prisma.tour.count.mockResolvedValue(1);
      prisma.tour.findMany.mockResolvedValue([
        makeTour({
          images: [],
          categories: [{ categoryId: 'cat-1', isPrimary: true }],
          hubs: [],
        }),
      ]);
      const res = await service.search({
        q: 'catamaran',
        destinationSlug: 'curacao',
      });
      const where = prisma.tour.findMany.mock.calls[0][0].where;
      expect(where.destination).toEqual({ slug: 'curacao' });
      expect(where.status).toBe(TourStatus.LIVE);
      // The text match is an id set from the accent-folding SQL, not a Prisma
      // `OR` of `contains` - `ILIKE` folds case but not accents, so "curacao"
      // would never have matched "Curaçao".
      expect(where.AND).toEqual([{ id: { in: ['t-1'] } }]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(res.query).toBe('catamaran');
      expect(res.data[0].categoryIds).toEqual(['cat-1']);
    });

    it('returns nothing when no tour text matches, without a second guess', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);

      const res = await service.search({ q: 'zzzz' });

      // An empty id set means "no match" - it must narrow to nothing rather
      // than being dropped as a falsy filter and returning the whole catalogue.
      expect(prisma.tour.findMany.mock.calls[0][0].where.AND).toEqual([
        { id: { in: [] } },
      ]);
      expect(res.total).toBe(0);
    });

    it('ANDs the text match with the date filter instead of overwriting it', async () => {
      // Both narrow by id. Written as one object they would collide on the same
      // key and the last one would silently win, dropping the other filter.
      prisma.$queryRaw.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);
      prisma.departure.findMany.mockResolvedValue([]);
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);

      await service.search({ q: 'catamaran', date: '2026-08-27' });

      const and = prisma.tour.findMany.mock.calls[0][0].where.AND;
      expect(and).toHaveLength(2);
      expect(and[0]).toEqual({ id: { in: ['t-1', 't-2'] } });
      expect(and[1]).toHaveProperty('id.in');
    });

    // ── Pastel #44: the search page mounts the listing toolbar ────────────────

    it('applies the toolbar filters exactly as the listing endpoint does', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);

      await service.search({
        q: 'catamaran',
        minPrice: 50,
        maxPrice: 300,
        durationMin: 120,
        durationMax: 240,
        ratingMin: 4,
        cancellationMaxHours: 24,
        pickupAvailable: true,
      });

      // Same helper both endpoints call - a divergence here is the shared
      // toolbar meaning two different things on two pages.
      const where = prisma.tour.findMany.mock.calls[0][0].where;
      expect(where.priceFrom).toEqual({ gte: 50, lte: 300 });
      expect(where.durationMinutesFrom).toEqual({ gte: 120, lte: 240 });
      expect(where.aggregateRating).toEqual({ gte: 4 });
      expect(where.cancellationHours).toEqual({ lte: 24 });
      expect(where.pickupModel).toEqual({ not: PickupModel.NONE });
    });

    it('ORs the category quick-filter chips, like the listing multi-select', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);

      await service.search({
        q: 'catamaran',
        categoryIds: ['cat-1', 'cat-2'],
      });

      expect(prisma.tour.findMany.mock.calls[0][0].where.categories).toEqual({
        some: { categoryId: { in: ['cat-1', 'cat-2'] } },
      });
    });

    it('leaves the category filter off entirely when no chip is selected', async () => {
      // An empty `in: []` would narrow to nothing - every search would return 0.
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);

      await service.search({ q: 'catamaran', categoryIds: [] });

      expect(
        prisma.tour.findMany.mock.calls[0][0].where.categories,
      ).toBeUndefined();
    });

    it('passes guests and timeOfDay into the date-availability filter', async () => {
      // Without a date these are inert; with one they must reach the departure
      // scan, or the travelers pill silently does nothing on this page.
      prisma.departure.findMany.mockResolvedValue([]);
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);

      await service.search({
        q: 'catamaran',
        date: '2026-08-27',
        guests: 4,
        timeOfDay: ['morning'],
      });

      expect(prisma.departure.findMany).toHaveBeenCalled();
      const and = prisma.tour.findMany.mock.calls[0][0].where.AND;
      expect(and).toHaveLength(2);
    });

    it('orders by relevance: a name match outranks a category-name match', async () => {
      // The raw matcher scores WHERE the term hit. The candidate list arrives in
      // canonical rank order, so relevance has to re-order it - the id list the
      // page is finally hydrated from is what proves it did.
      prisma.$queryRaw.mockResolvedValue([
        { id: 'buried', score: 20 },
        { id: 'named', score: 100 },
        { id: 'category', score: 40 },
      ]);
      prisma.tour.count.mockResolvedValue(3);
      prisma.tour.findMany
        // 1: the canonically-ranked candidate pool.
        .mockResolvedValueOnce([
          { id: 'buried' },
          { id: 'named' },
          { id: 'category' },
        ])
        // 2: hydration of the ranked page.
        .mockResolvedValueOnce([]);

      await service.search({ q: 'catamaran' });

      expect(prisma.tour.findMany.mock.calls[1][0].where).toEqual({
        id: { in: ['named', 'category', 'buried'] },
      });
    });

    it('keeps canonical rank as the tie-break inside a relevance tier', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 'a', score: 60 },
        { id: 'b', score: 60 },
      ]);
      prisma.tour.count.mockResolvedValue(2);
      prisma.tour.findMany
        // Canonical order puts 'b' first (is_sponsored / tier_rank / quality).
        .mockResolvedValueOnce([{ id: 'b' }, { id: 'a' }])
        .mockResolvedValueOnce([]);

      await service.search({ q: 'catamaran' });

      expect(prisma.tour.findMany.mock.calls[1][0].where).toEqual({
        id: { in: ['b', 'a'] },
      });
    });

    it('takes the plain skip/take path for a price sort - no candidate pool', async () => {
      prisma.tour.count.mockResolvedValue(1);
      prisma.tour.findMany.mockResolvedValue([]);

      await service.search({ q: 'catamaran', sort: SearchSort.price_asc });

      // One query, not the two the relevance ranking needs.
      expect(prisma.tour.findMany).toHaveBeenCalledTimes(1);
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.take).toBe(20);
      expect(call.orderBy).toEqual(
        expect.arrayContaining([{ priceFrom: { sort: 'asc', nulls: 'last' } }]),
      );
    });
  });

  // ── findBySlug - flat URL (no hub nesting) ─────────────────────────────────────

  describe('findBySlug', () => {
    it('resolves purely by destination + slug (no hub condition)', async () => {
      prisma.tour.findFirst.mockResolvedValue(
        makeTour({
          images: [],
          translations: [],
          inclusions: [],
          exclusions: [],
          locations: [],
          pickupLocations: [],
          features: [],
          ageBands: [],
          addOns: [],
          languages: [],
          schedules: [],
          categories: [{ categoryId: 'cat-1', isPrimary: true }],
          hubs: [],
        }),
      );
      const result: any = await service.findBySlug('sunset-catamaran-cruise', {
        destinationSlug: 'curacao',
      });
      const whereArg = prisma.tour.findFirst.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('hub');
      expect(whereArg).not.toHaveProperty('hubId');
      expect(whereArg.destination).toEqual({ slug: 'curacao' });
      expect(result.categoryIds).toEqual(['cat-1']);
    });

    it('throws 404 when not found', async () => {
      prisma.tour.findFirst.mockResolvedValue(null);
      await expect(
        service.findBySlug('x', { destinationSlug: 'curacao' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── publish ─────────────────────────────────────────────────────────────────

  // ── Approval workflow (conflict #1: publishing is always Island Tours') ──
  describe('approval workflow', () => {
    // Two tests below drive ADMIN_EMAIL in opposite directions; restore it so
    // neither leaks into the rest of the file.
    const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    afterEach(() => {
      if (ORIGINAL_ADMIN_EMAIL === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
    });

    const ready = (over: Record<string, unknown> = {}) =>
      makeTour({
        images: [
          { id: 'i1', isHero: true },
          { id: 'i2', isHero: false },
          { id: 'i3' },
          { id: 'i4' },
          { id: 'i5' },
        ],
        highlights: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
        translations: [{ overview: 'A lovely cruise overview.' }],
        approvalStatus: TourApprovalStatus.NOT_SUBMITTED,
        ...over,
      });

    it('submitForReview flips NOT_SUBMITTED -> PENDING and clears the old note', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        ready({
          approvalStatus: TourApprovalStatus.REJECTED,
          reviewNote: 'Blurry photos',
        }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
      );

      await service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            approvalStatus: TourApprovalStatus.PENDING,
            submittedAt: expect.any(Date),
            reviewNote: null,
          },
        }),
      );
    });

    it('submitForReview runs the SAME readiness bar as publish', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      // 0 images / 0 highlights / no overview -> blocked with the full list.
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          images: [],
          highlights: [],
          translations: [],
          approvalStatus: TourApprovalStatus.NOT_SUBMITTED,
        }),
      );
      await expect(
        service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('submitForReview 409s while already PENDING or APPROVED', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        ready({ approvalStatus: TourApprovalStatus.PENDING }),
      );
      await expect(
        service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);

      prisma.tour.findUnique.mockResolvedValue(
        ready({ approvalStatus: TourApprovalStatus.APPROVED }),
      );
      await expect(
        service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
    });

    // Operator test report 2026-08-01 §02: every exit from PAUSED and ARCHIVED
    // is MANAGE_TRIPS, so gating the REQUEST on DRAFT left an operator with a
    // paused tour able to archive it and nothing else, and one with an archived
    // tour able to do nothing at all.
    describe('submitForReview from a parked tour', () => {
      it.each([
        ['PAUSED', TourStatus.PAUSED],
        ['ARCHIVED', TourStatus.ARCHIVED],
      ])(
        'accepts a %s tour and only stamps the request',
        async (_l, status) => {
          prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
          prisma.tour.findUnique.mockResolvedValue(ready({ status }));
          prisma.tour.update.mockResolvedValue(
            makeTour({ status, approvalStatus: TourApprovalStatus.PENDING }),
          );

          await service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR);

          const { data } = prisma.tour.update.mock.calls[0][0];
          expect(data.approvalStatus).toBe(TourApprovalStatus.PENDING);
          // THE boundary: asking never moves the tour. Going live stays an
          // admin's call (unpause / restore / publish are all MANAGE_TRIPS).
          expect(data.status).toBeUndefined();
        },
      );

      it('still refuses a LIVE tour - it is already published', async () => {
        prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
        prisma.tour.findUnique.mockResolvedValue(
          ready({ status: TourStatus.LIVE }),
        );

        await expect(
          service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.tour.update).not.toHaveBeenCalled();
      });

      it('lets an admin decide the request on a parked tour', async () => {
        prisma.tour.findUnique.mockResolvedValue(
          makeTour({
            status: TourStatus.PAUSED,
            approvalStatus: TourApprovalStatus.PENDING,
          }),
        );
        prisma.tour.update.mockResolvedValue(
          makeTour({
            status: TourStatus.PAUSED,
            approvalStatus: TourApprovalStatus.APPROVED,
          }),
        );

        await service.approveTour('tour-1', 'admin-1');

        expect(prisma.tour.update.mock.calls[0][0].data.approvalStatus).toBe(
          TourApprovalStatus.APPROVED,
        );
      });
    });

    // Client review #12 / master 2.3: Island Tours sets the slug AT REVIEW,
    // from the FINAL approved title - but only before first publish, and a
    // collision keeps the current slug rather than failing the approval.
    it('approval realigns a never-published slug to the approved title', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          approvalStatus: TourApprovalStatus.PENDING,
          name: 'Reef Diving Adventure',
          slug: 'old-provisional-slug',
          firstPublishedAt: null,
        }),
      );
      prisma.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.slugRegistry.findMany.mockResolvedValue([
        { destinationSlug: 'curacao' },
      ]);
      prisma.tour.update.mockResolvedValue(
        makeTour({ slug: 'reef-diving-adventure' }),
      );

      await service.approveTour('tour-1', 'admin-1');

      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
          data: { slug: 'reef-diving-adventure' },
        }),
      );
      expect(prisma.tour.update.mock.calls[0][0].data.slug).toBe(
        'reef-diving-adventure',
      );
    });

    it('a published tour keeps its address on approval', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          status: TourStatus.PAUSED,
          approvalStatus: TourApprovalStatus.PENDING,
          name: 'Renamed While Paused',
          slug: 'original-live-slug',
          firstPublishedAt: new Date('2026-01-01'),
        }),
      );
      prisma.tour.update.mockResolvedValue(makeTour());

      await service.approveTour('tour-1', 'admin-1');

      expect(prisma.slugRegistry.updateMany).not.toHaveBeenCalled();
      expect(prisma.tour.update.mock.calls[0][0].data.slug).toBeUndefined();
    });

    it('a colliding approved-title slug is kept - approval never fails over an address', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          approvalStatus: TourApprovalStatus.PENDING,
          name: 'Reef Diving Adventure',
          slug: 'old-provisional-slug',
          firstPublishedAt: null,
        }),
      );
      prisma.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      prisma.tour.findFirst.mockResolvedValue({ id: 'other-tour' });
      prisma.tour.update.mockResolvedValue(makeTour());

      await service.approveTour('tour-1', 'admin-1');

      expect(prisma.tour.update.mock.calls[0][0].data.slug).toBeUndefined();
      expect(prisma.tour.update.mock.calls[0][0].data.approvalStatus).toBe(
        TourApprovalStatus.APPROVED,
      );
    });

    it('a slug write race (P2002 past the pre-check) approves with the current slug', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          approvalStatus: TourApprovalStatus.PENDING,
          name: 'Reef Diving Adventure',
          slug: 'old-provisional-slug',
          firstPublishedAt: null,
        }),
      );
      prisma.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.slugRegistry.findMany.mockResolvedValue([
        { destinationSlug: 'curacao' },
      ]);
      // Both admins passed the pre-check; this transaction is the loser.
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
      prisma.tour.update.mockResolvedValue(makeTour());

      await service.approveTour('tour-1', 'admin-1');

      const fallback = prisma.tour.update.mock.calls.at(-1)?.[0];
      expect(fallback.data.approvalStatus).toBe(TourApprovalStatus.APPROVED);
      expect(fallback.data.slug).toBeUndefined();
    });

    it('approve requires PENDING; reject stores the actionable note', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.REJECTED }),
      );
      await service.rejectTour('tour-1', 'admin', 'Photos are blurry');
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            approvalStatus: TourApprovalStatus.REJECTED,
            reviewNote: 'Photos are blurry',
          },
        }),
      );

      // Not PENDING -> 409 (both verbs).
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.NOT_SUBMITTED }),
      );
      await expect(service.approveTour('tour-1', 'admin')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.rejectTour('tour-1', 'admin', 'x')).rejects.toThrow(
        ConflictException,
      );
    });

    // ── Review-round-trip email (fire-and-forget) ────────────────────────────
    //
    // Both notifications load their OWN recipient with a second findUnique, so
    // these tests queue that second resolution behind the guard read.

    it('emails the reviewer mailbox on submit, and never blocks on it', async () => {
      process.env.ADMIN_EMAIL = 'reviews@islandtours.test';
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique
        .mockResolvedValueOnce(ready())
        .mockResolvedValueOnce({
          name: 'Sunset Catamaran Cruise',
          destination: { name: 'Curacao' },
          operator: {
            companyInfo: { companyName: 'Miss Ann Boat Trips' },
            user: { name: 'Op Owner' },
          },
        });
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
      );

      await service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR);
      // Fire-and-forget: the promise chain settles after the method returns.
      await Promise.resolve();
      await Promise.resolve();

      expect(mail.sendTourSubmittedForReviewEmail).toHaveBeenCalledWith(
        'reviews@islandtours.test',
        expect.objectContaining({
          tourName: 'Sunset Catamaran Cruise',
          operatorName: 'Miss Ann Boat Trips',
          destinationName: 'Curacao',
        }),
      );
    });

    it('submits successfully even with no reviewer mailbox configured', async () => {
      delete process.env.ADMIN_EMAIL;
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(ready());
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
      );

      await expect(
        service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).resolves.toBeDefined();
      expect(mail.sendTourSubmittedForReviewEmail).not.toHaveBeenCalled();
    });

    it('emails the operator the review note, preferring their contact address', async () => {
      prisma.tour.findUnique
        .mockResolvedValueOnce(
          makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
        )
        .mockResolvedValueOnce({
          name: 'Sunset Catamaran Cruise',
          operator: {
            contactEmail: 'tours@missann.test',
            user: { name: 'Op Owner', email: 'owner@missann.test' },
          },
        });
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.REJECTED }),
      );

      await service.rejectTour('tour-1', 'admin', '  Photos are blurry  ');
      await Promise.resolve();
      await Promise.resolve();

      expect(mail.sendTourChangesRequestedEmail).toHaveBeenCalledWith(
        'tours@missann.test',
        expect.objectContaining({
          tourName: 'Sunset Catamaran Cruise',
          note: 'Photos are blurry',
          name: 'Op Owner',
        }),
      );
    });

    it('falls back to the owner login when the operator has no contact address', async () => {
      prisma.tour.findUnique
        .mockResolvedValueOnce(
          makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
        )
        .mockResolvedValueOnce({
          name: 'Sunset Catamaran Cruise',
          operator: {
            contactEmail: null,
            user: { name: 'Op Owner', email: 'owner@missann.test' },
          },
        });
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.REJECTED }),
      );

      await service.rejectTour('tour-1', 'admin', 'Photos are blurry');
      await Promise.resolve();
      await Promise.resolve();

      expect(mail.sendTourChangesRequestedEmail).toHaveBeenCalledWith(
        'owner@missann.test',
        expect.anything(),
      );
    });

    it('emails the operator on approval, without claiming the tour is live', async () => {
      prisma.tour.findUnique
        .mockResolvedValueOnce(
          makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
        )
        .mockResolvedValueOnce({
          name: 'Sunset Catamaran Cruise',
          operator: {
            contactEmail: 'tours@missann.test',
            user: { name: 'Op Owner', email: 'owner@missann.test' },
          },
        });
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.APPROVED }),
      );

      await service.approveTour('tour-1', 'admin', '  Lovely photos  ');
      await Promise.resolve();
      await Promise.resolve();

      expect(mail.sendTourApprovedEmail).toHaveBeenCalledWith(
        'tours@missann.test',
        expect.objectContaining({
          tourName: 'Sunset Catamaran Cruise',
          note: 'Lovely photos',
          name: 'Op Owner',
        }),
      );
    });

    it('approves without a note and sends none', async () => {
      prisma.tour.findUnique
        .mockResolvedValueOnce(
          makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
        )
        .mockResolvedValueOnce({
          name: 'Sunset Catamaran Cruise',
          operator: {
            contactEmail: 'tours@missann.test',
            user: { name: 'Op Owner', email: 'owner@missann.test' },
          },
        });
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.APPROVED }),
      );

      await service.approveTour('tour-1', 'admin');
      await Promise.resolve();
      await Promise.resolve();

      expect(mail.sendTourApprovedEmail).toHaveBeenCalledWith(
        'tours@missann.test',
        expect.objectContaining({ note: undefined }),
      );
    });

    it('still records the verdict when the email throws', async () => {
      mail.sendTourChangesRequestedEmail.mockRejectedValue(
        new Error('Resend is down'),
      );
      prisma.tour.findUnique
        .mockResolvedValueOnce(
          makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
        )
        .mockResolvedValueOnce({
          name: 'Sunset Catamaran Cruise',
          operator: {
            contactEmail: 'tours@missann.test',
            user: { name: 'Op Owner', email: 'owner@missann.test' },
          },
        });
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.REJECTED }),
      );

      await expect(
        service.rejectTour('tour-1', 'admin', 'Photos are blurry'),
      ).resolves.toBeDefined();
      await Promise.resolve();
      await Promise.resolve();
      expect(prisma.tour.update).toHaveBeenCalled();
    });

    it('publish blocks a non-admin on an unapproved tour', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        ready({ approvalStatus: TourApprovalStatus.PENDING }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('an ADMIN publish stamps the approval (publish IS the review)', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        ready({ approvalStatus: TourApprovalStatus.NOT_SUBMITTED }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await service.publish('tour-1', 'admin', Role.ADMIN);
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TourStatus.LIVE,
            approvalStatus: TourApprovalStatus.APPROVED,
          }),
        }),
      );
    });
  });

  describe('publish', () => {
    const ready = (overrides: Record<string, unknown> = {}) =>
      makeTour({
        images: [
          { id: 'i1', isHero: true },
          { id: 'i2', isHero: false },
          { id: 'i3' },
          { id: 'i4' },
          { id: 'i5' },
        ],
        highlights: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
        translations: [{ overview: 'A lovely cruise overview.' }],
        ...overrides,
      });

    it('publishes a ready DRAFT tour and flattens the result', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(ready());
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );

      const result: any = await service.publish(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: TourStatus.LIVE,
            publishedAt: expect.any(Date),
            // Nothing wrote this before: the tier engine read the resulting
            // null as "still provisional" and never demoted the tour.
            firstPublishedAt: expect.any(Date),
            isBookable: true,
            // LIVE implies APPROVED (conflict #1) - publish stamps it.
            approvalStatus: TourApprovalStatus.APPROVED,
          },
        }),
      );
      expect(availability.computeIsBookable).toHaveBeenCalledWith('tour-1');
      expect(result.categoryIds).toEqual(['cat-1']);
    });

    it('keeps the original firstPublishedAt when a tour is published again', async () => {
      const original = new Date('2025-03-01T00:00:00.000Z');
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        ready({ firstPublishedAt: original }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );

      await service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR);

      const data = prisma.tour.update.mock.calls[0][0].data as {
        firstPublishedAt: Date;
        publishedAt: Date;
      };
      expect(data.firstPublishedAt).toBe(original);
      expect(data.publishedAt).not.toBe(original);
    });

    it('collects all readiness errors', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ images: [], translations: [], ageBands: [] }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires a price (no basePrice and no age bands → blocked)', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        basePrice: null,
        _count: { ageBands: 0 },
      });
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toMatchObject({
        response: {
          message: expect.arrayContaining([
            expect.stringMatching(/price is required/i),
          ]),
        },
      });
    });

    it('allows publish when a base price is set', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({ ...ready(), basePrice: 150 });
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).resolves.toBeDefined();
    });

    it('allows publish with age bands but no base price', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        basePrice: null,
        _count: { ageBands: 2 },
      });
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).resolves.toBeDefined();
    });

    // UNIT (whole-unit/charter) tours require a base price AND a unit type -
    // age bands never satisfy the price requirement for this pricing model.
    it('blocks publish for a UNIT tour with no base price', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        pricingModel: PricingModel.UNIT,
        basePrice: null,
        wholeUnitType: WholeUnitType.BOAT,
      });
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toMatchObject({
        response: {
          message: expect.arrayContaining([
            expect.stringMatching(/unit-priced tours require a base price/i),
          ]),
        },
      });
    });

    it('blocks publish for a UNIT tour with no unit type', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        pricingModel: PricingModel.UNIT,
        basePrice: 500,
        wholeUnitType: null,
      });
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toMatchObject({
        response: {
          message: expect.arrayContaining([
            expect.stringMatching(/unit-priced tours require a unit type/i),
          ]),
        },
      });
    });

    it('publishes a ready UNIT tour that has both a base price and a unit type', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        pricingModel: PricingModel.UNIT,
        basePrice: 500,
        wholeUnitType: WholeUnitType.BOAT,
      });
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).resolves.toBeDefined();
    });
  });

  describe('recomputePriceFrom', () => {
    // priceFrom falls back to basePrice until age bands (TourAgeBand) are entered.
    it('anchors priceFrom to basePrice when no age bands exist', async () => {
      prisma.tour.findUnique.mockResolvedValue({ basePrice: 200 });
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(200);
      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { priceFrom: 200 },
      });
    });

    it('persists basePrice as priceFrom when no age bands exist', async () => {
      prisma.tour.findUnique.mockResolvedValue({ basePrice: 99 });
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(99);
    });

    it('anchors priceFrom to the anchor (default) age band when bands exist', async () => {
      prisma.tour.findUnique.mockResolvedValue({ basePrice: 200 });
      prisma.tourAgeBand.findFirst.mockResolvedValue({ price: 75 });
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(75);
      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { priceFrom: 75 },
      });
    });

    // UNIT (whole-unit/charter) tours anchor on basePrice directly - age bands
    // are a PER_PERSON construct and must never be queried for a UNIT tour.
    it('UNIT tours anchor priceFrom on basePrice and never query age bands', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        basePrice: 400,
        pricingModel: PricingModel.UNIT,
      });
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(400);
      expect(prisma.tourAgeBand.findFirst).not.toHaveBeenCalled();
      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { priceFrom: 400 },
      });
    });

    // Founder rule: the "From $X per person" anchor is the DEFAULT band (the
    // adult reference price), never a cheaper child/senior band. The query
    // orders isDefault DESC first, so cheapest-price is only the fallback when
    // no band is flagged default.
    it('PER_PERSON tours anchor priceFrom on the DEFAULT participant age band', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        basePrice: 200,
        pricingModel: PricingModel.PER_PERSON,
      });
      prisma.tourAgeBand.findFirst.mockResolvedValue({ price: 69 });
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(69);
      expect(prisma.tourAgeBand.findFirst).toHaveBeenCalledWith({
        where: {
          tourId: 'tour-1',
          participation: BandParticipation.PARTICIPANT,
        },
        orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
        select: { price: true },
      });
    });

    it('PER_PERSON tours fall back to basePrice when no age bands exist', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        basePrice: 90,
        pricingModel: PricingModel.PER_PERSON,
      });
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(90);
    });
  });

  // ── pause / unpause ───────────────────────────────────────────────────────────

  describe('pause / unpause', () => {
    it('pauses a LIVE tour (owner)', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.PAUSED }),
      );
      const result: any = await service.pause(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(result.status).toBe(TourStatus.PAUSED);
    });

    it('rejects pause when not LIVE', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      await expect(
        service.pause('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 403 for a non-owner operator', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-OTHER' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE, operatorId: 'op-1' }),
      );
      await expect(
        service.pause('tour-1', 'user-2', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── archive / restore / remove - always-flat slug_registry ─────────────────────

  describe('archive / restore / remove', () => {
    it('archive deactivates the TOUR slug_registry row (always)', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED, isActive: false }),
      );
      await service.archive('tour-1', 'admin', Role.ADMIN);
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: { isActive: false },
      });
    });

    it('restore re-activates the slug_registry row', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      await service.restore('tour-1', 'admin', Role.ADMIN);
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: { isActive: true },
      });
    });

    it('operator can only delete ARCHIVED tours', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await expect(
        service.remove('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    // The FK that used to 500: bookings (and reviews) deliberately do not
    // cascade off Tour - they are financial/reputation records. remove()
    // must refuse with the reason BEFORE the delete reaches Postgres.
    it('refuses to delete a tour that has bookings or reviews - even for ADMIN', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.booking.count.mockResolvedValue(3);
      prisma.review.count.mockResolvedValue(1);
      await expect(
        service.remove('tour-1', 'admin', Role.ADMIN),
      ).rejects.toThrow(/3 bookings and 1 review\b.*archive the tour instead/);
      expect(prisma.tour.delete).not.toHaveBeenCalled();
    });

    it('remove deletes the tour and starts the 90-day slug cooldown (keeps the registry row)', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED }),
      );
      prisma.tour.delete.mockResolvedValue(makeTour());
      await service.remove('tour-1', 'admin', Role.ADMIN);
      // Cooldown stamp: row is kept (isActive=false, deletedAt set), not deleted.
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date),
        }),
      });
      expect(prisma.tour.delete).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
      });
    });
  });

  // ── update - category/hub replacement + primary re-point ───────────────────────

  describe('update', () => {
    it('replaces the category set and re-points the primary', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(
        makeTour({
          categories: [
            { categoryId: 'cat-1', isPrimary: false },
            { categoryId: 'cat-2', isPrimary: true },
          ],
        }),
      );

      const dto: UpdateTourDto = {
        categoryIds: ['cat-1', 'cat-2'],
        primaryCategoryId: 'cat-2',
      };
      const result = await service.update('tour-1', dto, 'admin', Role.ADMIN);

      expect(prisma.tourCategory.deleteMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
      });
      expect(prisma.tourCategory.createMany).toHaveBeenCalledWith({
        data: [
          { tourId: 'tour-1', categoryId: 'cat-1', isPrimary: false },
          { tourId: 'tour-1', categoryId: 'cat-2', isPrimary: true },
        ],
      });
      expect(result.tour.primaryCategoryId).toBe('cat-2');
    });

    it('re-points the primary among existing categories when only primaryCategoryId is given', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      prisma.tourCategory.findUnique.mockResolvedValue({
        id: 'tc-2',
        category: { parentCategoryId: null },
      });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { primaryCategoryId: 'cat-2' },
        'admin',
        Role.ADMIN,
      );
      expect(prisma.tourCategory.updateMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        data: { isPrimary: false },
      });
      expect(prisma.tourCategory.update).toHaveBeenCalledWith({
        where: { id: 'tc-2' },
        data: { isPrimary: true },
      });
    });

    it('rejects updating an archived tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED }),
      );
      await expect(
        service.update('tour-1', { name: 'x' }, 'admin', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    // ── cancellation_hours on a published tour (access-roles matrix) ──
    // Booking deadlines derive from cancellationHours at read time, so a
    // change on a non-DRAFT tour retroactively moves existing bookings'
    // deadlines - operator-blocked, admin-only.

    it('blocks an operator changing cancellationHours on a LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE, cancellationHours: 48 }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      await expect(
        service.update(
          'tour-1',
          { cancellationHours: 24 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('allows the operator to send the UNCHANGED cancellationHours on a LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE, cancellationHours: 48 }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());
      await expect(
        service.update(
          'tour-1',
          { cancellationHours: 48, name: 'Renamed' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).resolves.toBeDefined();
    });

    // ── Live-tour content gate (client review #19 / dashboard #80) ──
    // Title changes on a LIVE tour are HELD for review; price and booking
    // cutoff stay the instant lane so operators can react to the market.

    it("holds an operator's title change on a LIVE tour for review", async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      const result = await service.update(
        'tour-1',
        { name: 'A Bolder New Title' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(pendingChanges.setStashedName).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tour-1' }),
        'user-1',
        'A Bolder New Title',
      );
      // The stored row is untouched: no name in the applied update.
      expect(prisma.tour.update.mock.calls[0][0].data.name).toBeUndefined();
      expect(result.warnings.join(' ')).toContain('review');
    });

    it('applies price and booking cutoff instantly on a LIVE tour (operator)', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      const result = await service.update(
        'tour-1',
        { basePrice: '99.00', bookingCutoffMinutes: 60 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      const data = prisma.tour.update.mock.calls[0][0].data;
      expect(data.basePrice).toBe('99.00');
      expect(data.bookingCutoffMinutes).toBe(60);
      expect(pendingChanges.setStashedName).not.toHaveBeenCalled();
      expect(result.warnings).toEqual([]);
    });

    it("an ADMIN's title change on a LIVE tour applies instantly", async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { name: 'Editorial Title' },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.tour.update.mock.calls[0][0].data.name).toBe(
        'Editorial Title',
      );
      expect(pendingChanges.setStashedName).not.toHaveBeenCalled();
    });

    it("an operator's title change on a DRAFT tour applies instantly", async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { name: 'Draft Rename' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tour.update.mock.calls[0][0].data.name).toBe(
        'Draft Rename',
      );
      expect(pendingChanges.setStashedName).not.toHaveBeenCalled();
    });

    it('lets an ADMIN change cancellationHours on a LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE, cancellationHours: 48 }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());
      await expect(
        service.update(
          'tour-1',
          { cancellationHours: 72 },
          'admin',
          Role.ADMIN,
        ),
      ).resolves.toBeDefined();
    });

    it('lets an operator change cancellationHours while still DRAFT', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT, cancellationHours: 48 }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());
      await expect(
        service.update(
          'tour-1',
          { cancellationHours: 24 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).resolves.toBeDefined();
    });

    // ── Pricing model switch → unit fields are force-nulled/applied together ──

    it('switching pricingModel to PER_PERSON force-nulls the unit fields', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          status: TourStatus.DRAFT,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.BOAT,
          unitIncludedGuests: 4,
          extraPersonPrice: '10.00',
          basePrice: '500.00',
        }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { pricingModel: PricingModel.PER_PERSON },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.PER_PERSON,
            wholeUnitType: null,
            unitIncludedGuests: null,
            extraPersonPrice: null,
          }),
        }),
      );
    });

    it('switching pricingModel to UNIT applies the supplied unit fields', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          status: TourStatus.DRAFT,
          pricingModel: PricingModel.PER_PERSON,
        }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        {
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.GROUP,
          unitIncludedGuests: 6,
          extraPersonPrice: '15.00',
        },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.UNIT,
            wholeUnitType: WholeUnitType.GROUP,
            unitIncludedGuests: 6,
            extraPersonPrice: '15.00',
          }),
        }),
      );
    });

    it('switching a UNIT tour to a non-GROUP unit type nulls the surcharge fields', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          status: TourStatus.DRAFT,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.GROUP,
        }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { wholeUnitType: WholeUnitType.BOAT },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            wholeUnitType: WholeUnitType.BOAT,
            unitIncludedGuests: null,
            extraPersonPrice: null,
          }),
        }),
      );
    });

    it('keeping a GROUP unit tour still applies updated surcharge fields', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          status: TourStatus.DRAFT,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.GROUP,
        }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { unitIncludedGuests: 2 },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitIncludedGuests: 2,
          }),
        }),
      );
    });

    // ── Slug rename → auto 301 + cooldown (master slug-registry rules) ──
    it('renames the slug: re-points the registry row and writes a 301 redirect', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT, slug: 'old-slug' }),
      );
      prisma.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      prisma.tour.findFirst.mockResolvedValue(null); // no other tour holds the new slug
      prisma.slugRegistry.findUnique.mockResolvedValue(null); // isSlugTaken → free
      prisma.slugRegistry.findMany.mockResolvedValue([
        { destinationSlug: 'curacao' },
      ]);
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(
        makeTour({ slug: 'new-slug' }),
      );

      await service.update('tour-1', { slug: 'new-slug' }, 'admin', Role.ADMIN);

      // Registry row re-pointed to the new slug.
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: { slug: 'new-slug' },
      });
      // Auto-301 from the old slug → new slug.
      expect(prisma.slugRedirect.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            destinationSlug_fromSlug: {
              destinationSlug: 'curacao',
              fromSlug: 'old-slug',
            },
          },
          create: expect.objectContaining({
            fromSlug: 'old-slug',
            toSlug: 'new-slug',
            statusCode: 301,
          }),
        }),
      );
      // The new slug is persisted on the tour.
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'new-slug' }),
        }),
      );
    });

    // The load-bearing assumption behind ignore-not-reject: every wizard
    // step's PATCH passes the STORED slug back (tripToUpdatePayload), so an
    // unchanged slug must be a pure no-op even on the admin path.
    it('an unchanged slug on an ADMIN save triggers no rename and no redirect', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT, slug: 'same-slug' }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(
        makeTour({ slug: 'same-slug' }),
      );

      await service.update(
        'tour-1',
        { slug: 'same-slug' },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.slugRegistry.updateMany).not.toHaveBeenCalled();
      expect(prisma.slugRedirect.upsert).not.toHaveBeenCalled();
    });

    // Client review #12: a non-admin's slug is IGNORED, not rejected - the
    // wizard passes the stored slug back on every save, so a 400 here would
    // break every operator save. No rename, no redirect, save succeeds.
    it('ignores a slug from a TOUR_OPERATOR - no rename, no redirect, save succeeds', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT, slug: 'old-slug' }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(
        makeTour({ slug: 'old-slug' }),
      );

      await service.update(
        'tour-1',
        { slug: 'sneaky-new-slug' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.slugRegistry.updateMany).not.toHaveBeenCalled();
      expect(prisma.slugRedirect.upsert).not.toHaveBeenCalled();
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ slug: expect.anything() }),
        }),
      );
    });

    it('rejects a rename onto a slug already taken by another entity', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT, slug: 'old-slug' }),
      );
      prisma.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      prisma.tour.findFirst.mockResolvedValue(null);
      // isSlugTaken → a protected row owned by a different entity holds the target slug.
      prisma.slugRegistry.findUnique.mockResolvedValue({
        entityId: 'other',
        deletedAt: null,
      });

      await expect(
        service.update('tour-1', { slug: 'taken-slug' }, 'admin', Role.ADMIN),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('locals-favourite (editorial)', () => {
    it('setLocalsFavourite flags a LIVE tour and returns it', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.tour.update.mockResolvedValue({
        id: 'tour-1',
        isLocalsFavourite: true,
      });

      const result = await service.setLocalsFavourite('tour-1', true, 'admin');

      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { isLocalsFavourite: true },
        select: { id: true, isLocalsFavourite: true },
      });
      expect(result).toEqual({ id: 'tour-1', isLocalsFavourite: true });
    });

    it('setLocalsFavourite rejects flagging a non-LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      await expect(
        service.setLocalsFavourite('tour-1', true, 'admin'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('setLocalsFavourite allows UN-flagging a non-LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED, isLocalsFavourite: true }),
      );
      prisma.tour.update.mockResolvedValue({
        id: 'tour-1',
        isLocalsFavourite: false,
      });

      const result = await service.setLocalsFavourite('tour-1', false, 'admin');
      expect(result).toEqual({ id: 'tour-1', isLocalsFavourite: false });
    });

    it('setLocalsFavourite throws NotFound for a missing tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(null);
      await expect(
        service.setLocalsFavourite('missing', true, 'admin'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('findAllAdmin filters by isLocalsFavourite when provided', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);

      await service.findAllAdmin({ isLocalsFavourite: true });

      const whereArg = prisma.tour.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({
        isLocalsFavourite: true,
        // The default admin-list exclusion (review loop lives on /submissions).
        approvalStatus: { notIn: ['PENDING', 'REJECTED'] },
      });
    });

    it('getLocalsFavouriteStats computes overall + per-destination coverage', async () => {
      // groupBy is called twice: [0] live-by-dest, [1] flagged-by-dest.
      prisma.tour.groupBy
        .mockResolvedValueOnce([
          { destinationId: 'dest-1', _count: { _all: 10 } },
          { destinationId: 'dest-2', _count: { _all: 5 } },
        ])
        .mockResolvedValueOnce([
          { destinationId: 'dest-1', _count: { _all: 3 } },
        ]);
      prisma.destination.findMany.mockResolvedValue([
        { id: 'dest-1', name: 'Aruba' },
        { id: 'dest-2', name: 'Curaçao' },
      ]);

      const stats = await service.getLocalsFavouriteStats();

      expect(stats.totalLive).toBe(15);
      expect(stats.flagged).toBe(3);
      expect(stats.pct).toBe(20); // 3/15
      expect(stats.target).toBe(30);
      // Sorted by destination name: Aruba, then Curaçao.
      expect(stats.perDestination).toEqual([
        {
          destinationId: 'dest-1',
          destinationName: 'Aruba',
          totalLive: 10,
          flagged: 3,
          pct: 30,
        },
        {
          destinationId: 'dest-2',
          destinationName: 'Curaçao',
          totalLive: 5,
          flagged: 0,
          pct: 0,
        },
      ]);
    });
  });

  // ── Badges (earned first, sponsored = paid-placement fallback; 2026-07-18) ──

  describe('deriveTourBadge (earned > sponsored fallback)', () => {
    const derive = (t: Record<string, unknown>) =>
      (service as any).deriveTourBadge({
        isSponsored: false,
        tierRank: 5,
        likelyToSellOut: false,
        likelyToSellOutOverride: null,
        publishedAt: null,
        aggregateRating: null,
        aggregateReviewCount: 0,
        ...t,
      });

    it('earned badges win over sponsored on paid placements', () => {
      expect(derive({ tierRank: 1, likelyToSellOut: true })).toBe(
        'likelyToSellOut',
      );
      expect(
        derive({
          isSponsored: true,
          aggregateRating: 4.8,
          aggregateReviewCount: 20,
        }),
      ).toBe('mostPopular');
      expect(
        derive({
          tierRank: 2,
          publishedAt: new Date(Date.now() - 5 * 86_400_000),
        }),
      ).toBe('new');
    });

    it('sponsored is the fallback for paid tiers P1-P3 and spotlight with no earned badge', () => {
      expect(derive({ tierRank: 1 })).toBe('sponsored');
      expect(
        derive({ tierRank: 3, aggregateRating: 4.8, aggregateReviewCount: 4 }),
      ).toBe('sponsored');
      expect(
        derive({
          isSponsored: true,
          aggregateRating: 4.3,
          aggregateReviewCount: 3,
        }),
      ).toBe('sponsored');
    });

    it('open tiers with nothing earned show no badge', () => {
      expect(derive({ tierRank: 4 })).toBeNull();
      expect(
        derive({ tierRank: 5, aggregateRating: 5, aggregateReviewCount: 4 }),
      ).toBeNull();
    });

    it('earned priority: sell-out > most popular > new', () => {
      expect(
        derive({
          likelyToSellOut: true,
          aggregateRating: 5,
          aggregateReviewCount: 50,
        }),
      ).toBe('likelyToSellOut');
      expect(derive({ aggregateRating: 4.6, aggregateReviewCount: 12 })).toBe(
        'mostPopular',
      );
    });
  });

  describe('applyMostPopularCap (master §3.6 "max 1 per category")', () => {
    it('keeps the badge on the first per category; later ones fall back to sponsored (paid) or none', () => {
      const items = [
        {
          badge: 'mostPopular',
          primaryCategoryId: 'cat-a',
          isSponsored: false,
          tierRank: 3,
        },
        {
          badge: 'mostPopular',
          primaryCategoryId: 'cat-a',
          isSponsored: false,
          tierRank: 2,
        },
        {
          badge: 'mostPopular',
          primaryCategoryId: 'cat-b',
          isSponsored: false,
          tierRank: 4,
        },
        {
          badge: 'mostPopular',
          primaryCategoryId: 'cat-a',
          isSponsored: false,
          tierRank: 5,
        },
        {
          badge: 'new',
          primaryCategoryId: 'cat-a',
          isSponsored: false,
          tierRank: 1,
        },
      ] as any[];
      (service as any).applyMostPopularCap(items);
      expect(items.map((i) => i.badge)).toEqual([
        'mostPopular', // first in cat-a keeps it
        'sponsored', // capped, paid tier -> sponsored fallback
        'mostPopular', // first in cat-b
        null, // capped, open tier -> no badge
        'new', // other badges untouched
      ]);
    });
  });

  // ── All-sold-out dead-end alternatives (AVAILABILITY-AND-DEPARTURES.md §8) ────

  describe('findDeadEndAlternatives', () => {
    /** A ranked candidate row as the ring query returns it (ids only). */
    const ids = (...v: string[]) => v.map((id) => ({ id }));

    /** A hydrated card row, as `loadAlternativeCards` selects it. */
    function card(id: string, overrides: Record<string, unknown> = {}) {
      return makeTour({
        id,
        name: `Tour ${id}`,
        slug: id,
        status: TourStatus.LIVE,
        destination: { slug: 'curacao' },
        images: [],
        translations: [],
        defaultCurrency: 'USD',
        tierRank: 5,
        likelyToSellOut: false,
        likelyToSellOutOverride: null,
        ...overrides,
      });
    }

    beforeEach(() => {
      prisma.tour.findUnique.mockResolvedValue({
        id: 'tour-1',
        destinationId: 'dest-1',
        categories: [
          { categoryId: 'cat-primary', isPrimary: true },
          { categoryId: 'cat-other', isPrimary: false },
        ],
      });
    });

    it('404s when the source tour does not exist', async () => {
      prisma.tour.findUnique.mockResolvedValue(null);
      await expect(
        service.findDeadEndAlternatives('nope', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('stops at the primary-category ring when it fills all 3 slots', async () => {
      prisma.tour.findMany.mockResolvedValueOnce(ids('a', 'b', 'c', 'd'));
      availability.nextBookableDateByTour.mockResolvedValueOnce(
        new Map([
          ['a', '2026-08-01'],
          ['b', '2026-08-02'],
          ['c', '2026-08-03'],
          ['d', '2026-08-04'],
        ]),
      );
      prisma.tour.findMany.mockResolvedValueOnce([
        card('a'),
        card('b'),
        card('c'),
      ]);

      const out = await service.findDeadEndAlternatives('tour-1', {});

      expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c']);
      // Ring 2 / ring 3 never ran: 1 candidate query + 1 hydrate query only.
      expect(prisma.tour.findMany).toHaveBeenCalledTimes(2);
      expect(out[0].nextAvailableDate).toBe('2026-08-01');
    });

    it('widens past a ring whose candidates all lack a departure this week', async () => {
      // Ring 1 (primary category) returns candidates, none with room.
      prisma.tour.findMany.mockResolvedValueOnce(ids('x', 'y'));
      availability.nextBookableDateByTour.mockResolvedValueOnce(new Map());
      // Ring 2 (other categories) has one.
      prisma.tour.findMany.mockResolvedValueOnce(ids('z'));
      availability.nextBookableDateByTour.mockResolvedValueOnce(
        new Map([['z', '2026-08-05']]),
      );
      prisma.tour.findMany.mockResolvedValueOnce([card('z')]);
      // Ring 3 (destination-wide) - nothing left.
      prisma.tour.findMany.mockResolvedValueOnce([]);

      const out = await service.findDeadEndAlternatives('tour-1', {});
      expect(out.map((t) => t.id)).toEqual(['z']);
    });

    it('never offers the source tour or a tour a wider ring already picked', async () => {
      prisma.tour.findMany.mockResolvedValueOnce(ids('a'));
      availability.nextBookableDateByTour.mockResolvedValueOnce(
        new Map([['a', '2026-08-01']]),
      );
      prisma.tour.findMany.mockResolvedValueOnce([card('a')]);
      prisma.tour.findMany.mockResolvedValueOnce([]);
      prisma.tour.findMany.mockResolvedValueOnce([]);

      await service.findDeadEndAlternatives('tour-1', {});

      // Every candidate query excludes the source tour, and later rings also
      // exclude what earlier rings already saw.
      const excluded = prisma.tour.findMany.mock.calls
        .map((c: any[]) => c[0]?.where?.id?.notIn)
        .filter(Boolean);
      expect(excluded[0]).toEqual(['tour-1']);
      expect(excluded[1]).toEqual(expect.arrayContaining(['tour-1', 'a']));
    });

    it('returns [] rather than throwing when the destination has nothing bookable', async () => {
      prisma.tour.findMany.mockResolvedValue([]);
      await expect(
        service.findDeadEndAlternatives('tour-1', {}),
      ).resolves.toEqual([]);
    });

    it('strips the commercial internals from every card', async () => {
      prisma.tour.findMany.mockResolvedValueOnce(ids('a'));
      availability.nextBookableDateByTour.mockResolvedValueOnce(
        new Map([['a', '2026-08-01']]),
      );
      prisma.tour.findMany.mockResolvedValueOnce([
        card('a', { tierRank: 1, commissionTier: '30.0', qualityScore: 88 }),
      ]);
      prisma.tour.findMany.mockResolvedValueOnce([]);
      prisma.tour.findMany.mockResolvedValueOnce([]);

      const [only] = await service.findDeadEndAlternatives('tour-1', {});
      expect(only.tierRank).toBeNull();
      expect(only.commissionTier).toBeNull();
      expect(only.qualityScore).toBeNull();
      // The badge is derived BEFORE neutralization, so it survives.
      expect(only.badge).toBe('sponsored');
    });
  });

  // ── WP-C: operator onboarding hooks (first-tour-live + INT-2) ───────────────

  describe('WP-C first-tour-live stamp (publish)', () => {
    const ready = (overrides: Record<string, unknown> = {}) =>
      makeTour({
        images: [
          { id: 'i1', isHero: true },
          { id: 'i2' },
          { id: 'i3' },
          { id: 'i4' },
          { id: 'i5' },
        ],
        highlights: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
        translations: [{ overview: 'A lovely cruise overview.' }],
        ...overrides,
      });

    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(ready());
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
    });

    it('stamps firstTourLiveAt one-shot and commits the outbox event with the tour update', async () => {
      prisma.operator.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.operator.updateMany).toHaveBeenCalledWith({
        where: { id: 'op-1', firstTourLiveAt: null },
        data: { firstTourLiveAt: expect.any(Date) },
      });
      // The winner writes the domain event in the SAME transaction (B6).
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          aggregate: 'operator',
          aggregateId: 'op-1',
          type: 'operator.first-tour-live',
          payload: { operatorId: 'op-1', tourId: 'tour-1' },
        },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('publishes without an event when the operator already has a live tour (guard lost)', async () => {
      prisma.operator.updateMany.mockResolvedValueOnce({ count: 0 });

      await service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      expect(prisma.tour.update).toHaveBeenCalled(); // the publish itself still lands
    });
  });

  describe('WP-C INT-2 sales alert (notifyReviewSubmitted)', () => {
    type WithNotify = { notifyReviewSubmitted(tourId: string): void };
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    const envBefore: Record<string, string | undefined> = {};

    beforeEach(() => {
      envBefore.ADMIN_EMAIL = process.env.ADMIN_EMAIL;
      envBefore.SALES_EMAIL = process.env.SALES_EMAIL;
      prisma.tour.findUnique.mockResolvedValue({
        name: 'Sunset Cruise along Spanish Water',
        submittedAt: new Date('2026-07-12T13:14:00.000Z'),
        destination: { name: 'Curaçao' },
        operator: {
          companyInfo: { companyName: 'Irie Tours B.V.' },
          user: { name: 'Mayra Martina' },
        },
      });
    });

    afterEach(() => {
      for (const key of ['ADMIN_EMAIL', 'SALES_EMAIL'] as const) {
        if (envBefore[key] === undefined) delete process.env[key];
        else process.env[key] = envBefore[key];
      }
    });

    it('sends BOTH the reviewer email and the sales variant when SALES_EMAIL differs', async () => {
      process.env.ADMIN_EMAIL = 'reviewer@island.tours';
      process.env.SALES_EMAIL = 'sales@island.tours';

      (service as unknown as WithNotify).notifyReviewSubmitted('tour-1');
      await flush();

      expect(mail.sendTourSubmittedForReviewEmail).toHaveBeenCalledWith(
        'reviewer@island.tours',
        expect.objectContaining({
          tourName: 'Sunset Cruise along Spanish Water',
        }),
      );
      expect(mail.sendTourSubmittedSalesEmail).toHaveBeenCalledWith(
        'sales@island.tours',
        expect.objectContaining({
          operatorName: 'Irie Tours B.V.',
          submittedAt: expect.any(Date),
        }),
      );
    });

    it('sends ONE email when SALES_EMAIL equals ADMIN_EMAIL', async () => {
      process.env.ADMIN_EMAIL = 'reviewer@island.tours';
      process.env.SALES_EMAIL = 'reviewer@island.tours';

      (service as unknown as WithNotify).notifyReviewSubmitted('tour-1');
      await flush();

      expect(mail.sendTourSubmittedForReviewEmail).toHaveBeenCalledTimes(1);
      expect(mail.sendTourSubmittedSalesEmail).not.toHaveBeenCalled();
    });

    it('sends ONE email when SALES_EMAIL is unset (fallback = same mailbox)', async () => {
      process.env.ADMIN_EMAIL = 'reviewer@island.tours';
      delete process.env.SALES_EMAIL;

      (service as unknown as WithNotify).notifyReviewSubmitted('tour-1');
      await flush();

      expect(mail.sendTourSubmittedForReviewEmail).toHaveBeenCalledTimes(1);
      expect(mail.sendTourSubmittedSalesEmail).not.toHaveBeenCalled();
    });

    it('still reaches sales when ADMIN_EMAIL is missing but SALES_EMAIL is set', async () => {
      delete process.env.ADMIN_EMAIL;
      process.env.SALES_EMAIL = 'sales@island.tours';

      (service as unknown as WithNotify).notifyReviewSubmitted('tour-1');
      await flush();

      expect(mail.sendTourSubmittedForReviewEmail).not.toHaveBeenCalled();
      expect(mail.sendTourSubmittedSalesEmail).toHaveBeenCalledWith(
        'sales@island.tours',
        expect.anything(),
      );
    });

    it('skips quietly (no throw) when neither mailbox is configured', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.SALES_EMAIL;

      (service as unknown as WithNotify).notifyReviewSubmitted('tour-1');
      await flush();

      expect(mail.sendTourSubmittedForReviewEmail).not.toHaveBeenCalled();
      expect(mail.sendTourSubmittedSalesEmail).not.toHaveBeenCalled();
    });
  });
});
