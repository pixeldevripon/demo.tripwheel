import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Permission, Role } from '@prisma/client';
import { MediaGalleryService } from './media-gallery.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import { CloudinaryService } from './cloudinary.service';

const mockPrismaService = {
  mediaGallery: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  operator: { findUnique: jest.fn() },
  staffMember: { findUnique: jest.fn() },
};

const mockCloudinaryService = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  generateSignedParams: jest.fn(),
};

// The scope MUST come from the effective-permission engine, not the static
// role table - a designation can revoke MANAGE_MEDIA from a STAFF seat.
const mockStaffPermissions = {
  getEffectivePermissions: jest.fn(),
};

describe('MediaGalleryService', () => {
  let service: MediaGalleryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default: no MANAGE_MEDIA - each test opts in explicitly.
    mockStaffPermissions.getEffectivePermissions.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaGalleryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        {
          provide: StaffPermissionsService,
          useValue: mockStaffPermissions,
        },
      ],
    }).compile();

    service = module.get<MediaGalleryService>(MediaGalleryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Conflict #6 stage 2: rows are scoped to the OPERATOR context, so team
  // seats share one library; platform content roles see everything.
  describe('operator-context scoping', () => {
    const query = {} as never;

    it('scopes an operator OWNER to the operator library (not their userId)', async () => {
      mockPrismaService.operator.findUnique.mockResolvedValue({ id: 'op1' });
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getMyMedia({ id: 'u1', role: Role.TOUR_OPERATOR }, query);

      const where = mockPrismaService.mediaGallery.findMany.mock.calls[0][0]
        .where as Record<string, unknown>;
      // Operator library + the orphan fallback (rows the backfill could not
      // attribute stay reachable by their uploader).
      expect(where.OR).toEqual([
        { operatorId: 'op1' },
        { operatorId: null, userId: 'u1' },
      ]);
    });

    it('resolves a team SEAT to the same shared operator library', async () => {
      // No Operator row for the seat user; the staffMember branch resolves.
      mockPrismaService.operator.findUnique.mockResolvedValue(null);
      mockPrismaService.staffMember.findUnique.mockResolvedValue({
        operatorId: 'op1',
        status: 'ACTIVE',
      });
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getMyMedia({ id: 'u2', role: Role.TOUR_OPERATOR }, query);

      const where = mockPrismaService.mediaGallery.findMany.mock.calls[0][0]
        .where as Record<string, unknown>;
      expect(where.OR).toEqual([
        { operatorId: 'op1' },
        { operatorId: null, userId: 'u2' },
      ]);
    });

    it('gives a MANAGE_MEDIA platform role the whole library', async () => {
      mockStaffPermissions.getEffectivePermissions.mockResolvedValue([
        Permission.MANAGE_MEDIA,
      ]);
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getMyMedia({ id: 'a1', role: Role.ADMIN }, query);

      const where = mockPrismaService.mediaGallery.findMany.mock.calls[0][0]
        .where as Record<string, unknown>;
      expect(where.operatorId).toBeUndefined();
      expect(where.userId).toBeUndefined();
      expect(where.OR).toBeUndefined();
    });

    it('pins a STAFF seat whose designation REVOKED manage-media to own rows', async () => {
      // The static role table grants STAFF manage-media; the effective set
      // (designation/revocations) is what actually decides. Reading the
      // static table here used to hand this seat the whole library.
      mockStaffPermissions.getEffectivePermissions.mockResolvedValue([
        Permission.VIEW_MEDIA,
        Permission.UPLOAD_MEDIA,
      ]);
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getMyMedia({ id: 's1', role: Role.STAFF }, query);

      const where = mockPrismaService.mediaGallery.findMany.mock.calls[0][0]
        .where as Record<string, unknown>;
      expect(where.userId).toBe('s1');
      expect(where.OR).toBeUndefined();
    });

    it('denies a SUSPENDED seat (resolveOperatorId refuses to resolve)', async () => {
      mockPrismaService.operator.findUnique.mockResolvedValue(null);
      mockPrismaService.staffMember.findUnique.mockResolvedValue({
        operatorId: 'op1',
        status: 'SUSPENDED',
      });
      await expect(
        service.getMyMedia({ id: 'u3', role: Role.TOUR_OPERATOR }, query),
      ).rejects.toThrow(BadRequestException);
    });

    it('pins bulk delete to the actor scope (no cross-operator IDOR)', async () => {
      mockPrismaService.operator.findUnique.mockResolvedValue({ id: 'op1' });
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([
        { id: 'm1', publicId: 'pid1' },
      ]);
      mockPrismaService.mediaGallery.deleteMany.mockResolvedValue({ count: 1 });

      await service.bulkDeleteMedia(['m1', 'm2'], {
        id: 'u1',
        role: Role.TOUR_OPERATOR,
      });

      const scope = [{ operatorId: 'op1' }, { operatorId: null, userId: 'u1' }];
      expect(mockPrismaService.mediaGallery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['m1', 'm2'] }, OR: scope },
        }),
      );
      expect(mockPrismaService.mediaGallery.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['m1'] }, OR: scope },
        }),
      );
    });
  });
});
