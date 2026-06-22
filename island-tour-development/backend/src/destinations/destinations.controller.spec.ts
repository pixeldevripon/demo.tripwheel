/**
 * Unit tests for DestinationController.
 *
 * The controller is a thin routing layer - these tests verify that each handler
 * delegates to the correct DestinationService method with the exact arguments
 * received from NestJS (params, query, body, authenticated user).
 *
 * DestinationService is fully mocked. No HTTP layer, no real guards.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Locale, Permission, Region } from '@prisma/client';
import { DestinationController } from './destinations.controller';
import { DestinationService } from './destinations.service';
import {
  CreateDestinationDto,
  CreateFaqDto,
  DestinationQueryDto,
  FaqLocaleQueryDto,
  LocaleQueryDto,
  UpdateDestinationDto,
  UpdateFaqDto,
  UpsertDestinationPageContentDto,
  UpsertDestinationTranslationsDto,
} from './dto/destination.dto';

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMockDestinationService() {
  return {
    getAll: jest.fn(),
    getActive: jest.fn(),
    getBySlug: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getAllTranslations: jest.fn(),
    getTranslationsByLocale: jest.fn(),
    upsertTranslations: jest.fn(),
    deleteTranslations: jest.fn(),
    getPageContent: jest.fn(),
    upsertPageContent: jest.fn(),
    getFaqs: jest.fn(),
    createFaq: jest.fn(),
    updateFaq: jest.fn(),
    deleteFaq: jest.fn(),
  };
}

// A minimal TypedAuthUser shape that satisfies id extraction in the controller
const mockAdminUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' } as any;

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('DestinationController', () => {
  let controller: DestinationController;
  let service: ReturnType<typeof createMockDestinationService>;

  beforeEach(async () => {
    service = createMockDestinationService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DestinationController],
      providers: [{ provide: DestinationService, useValue: service }],
    }).compile();

    controller = module.get<DestinationController>(DestinationController);
  });

  it('is correctly instantiated', () => {
    expect(controller).toBeDefined();
  });

  // ── getAll ───────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('delegates to service.getAll with the full query object', async () => {
      service.getAll.mockResolvedValue({ total: 0, page: 1, limit: 20, data: [] });

      const query: DestinationQueryDto = { page: 1, limit: 20, locale: Locale.en };
      await controller.getAll(query);

      expect(service.getAll).toHaveBeenCalledWith(query);
    });

    it('returns the service result unchanged', async () => {
      const expected = { total: 2, page: 1, limit: 20, data: [{ id: 'd1' }, { id: 'd2' }] };
      service.getAll.mockResolvedValue(expected);

      const result = await controller.getAll({});

      expect(result).toEqual(expected);
    });
  });

  // ── getActive ────────────────────────────────────────────────────────────────

  describe('getActive', () => {
    it('delegates to service.getActive with locale from query', async () => {
      service.getActive.mockResolvedValue([]);

      const query: LocaleQueryDto = { locale: Locale.nl };
      await controller.getActive(query);

      expect(service.getActive).toHaveBeenCalledWith(Locale.nl);
    });

    it('passes undefined locale when query is empty (service applies its own default)', async () => {
      service.getActive.mockResolvedValue([]);

      const query: LocaleQueryDto = {};
      await controller.getActive(query);

      expect(service.getActive).toHaveBeenCalledWith(undefined);
    });
  });

  // ── getBySlug ────────────────────────────────────────────────────────────────

  describe('getBySlug', () => {
    it('delegates to service.getBySlug with slug param and locale from query', async () => {
      service.getBySlug.mockResolvedValue({ id: 'd1', slug: 'curacao' });

      const query: LocaleQueryDto = { locale: Locale.en };
      await controller.getBySlug('curacao', query);

      expect(service.getBySlug).toHaveBeenCalledWith('curacao', Locale.en);
    });

    it('returns the service result unchanged', async () => {
      const expected = { id: 'd1', slug: 'curacao', name: 'Curaçao' };
      service.getBySlug.mockResolvedValue(expected);

      const result = await controller.getBySlug('curacao', { locale: Locale.en });

      expect(result).toEqual(expected);
    });
  });

  // ── getById ──────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('delegates to service.getById with id param and locale from query', async () => {
      service.getById.mockResolvedValue({ id: 'dest-1' });

      const query: LocaleQueryDto = { locale: Locale.en };
      await controller.getById('dest-1', query);

      expect(service.getById).toHaveBeenCalledWith('dest-1', Locale.en);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('delegates to service.create with dto and user.id', async () => {
      service.create.mockResolvedValue({ id: 'new-dest' });

      const dto: CreateDestinationDto = { name: 'Aruba', region: Region.CARIBBEAN };
      await controller.create(dto, mockAdminUser);

      expect(service.create).toHaveBeenCalledWith(dto, 'admin-1');
    });

    it('returns the service result unchanged', async () => {
      const created = { id: 'new-dest', name: 'Aruba', slug: 'aruba' };
      service.create.mockResolvedValue(created);

      const result = await controller.create({ name: 'Aruba', region: Region.CARIBBEAN }, mockAdminUser);

      expect(result).toEqual(created);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('delegates to service.update with id, dto, and user.id', async () => {
      service.update.mockResolvedValue({ id: 'dest-1' });

      const dto: UpdateDestinationDto = { name: 'Updated Name' };
      await controller.update('dest-1', dto, mockAdminUser);

      expect(service.update).toHaveBeenCalledWith('dest-1', dto, 'admin-1');
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('delegates to service.remove with id and user.id', async () => {
      service.remove.mockResolvedValue({ message: 'Destination deactivated successfully' });

      await controller.remove('dest-1', mockAdminUser);

      expect(service.remove).toHaveBeenCalledWith('dest-1', 'admin-1');
    });

    it('returns the service message result unchanged', async () => {
      const expected = { message: 'Destination deactivated successfully' };
      service.remove.mockResolvedValue(expected);

      const result = await controller.remove('dest-1', mockAdminUser);

      expect(result).toEqual(expected);
    });
  });

  // ── getAllTranslations ────────────────────────────────────────────────────────

  describe('getAllTranslations', () => {
    it('delegates to service.getAllTranslations with the destination id', async () => {
      service.getAllTranslations.mockResolvedValue([]);

      await controller.getAllTranslations('dest-1');

      expect(service.getAllTranslations).toHaveBeenCalledWith('dest-1');
    });
  });

  // ── getTranslationsByLocale ───────────────────────────────────────────────────

  describe('getTranslationsByLocale', () => {
    it('delegates to service.getTranslationsByLocale with id and parsed locale', async () => {
      service.getTranslationsByLocale.mockResolvedValue({ locale: Locale.nl });

      await controller.getTranslationsByLocale('dest-1', Locale.nl);

      expect(service.getTranslationsByLocale).toHaveBeenCalledWith('dest-1', Locale.nl);
    });
  });

  // ── upsertTranslations ───────────────────────────────────────────────────────

  describe('upsertTranslations', () => {
    it('delegates to service.upsertTranslations with id, locale, dto, and user.id', async () => {
      service.upsertTranslations.mockResolvedValue({});

      const dto: UpsertDestinationTranslationsDto = {
        fields: { name: 'Curaçao NL' },
        isMachineTranslated: false,
      };
      await controller.upsertTranslations('dest-1', Locale.nl, dto, mockAdminUser);

      expect(service.upsertTranslations).toHaveBeenCalledWith('dest-1', Locale.nl, dto, 'admin-1');
    });
  });

  // ── deleteTranslations ───────────────────────────────────────────────────────

  describe('deleteTranslations', () => {
    it('delegates to service.deleteTranslations with id, locale, and user.id', async () => {
      service.deleteTranslations.mockResolvedValue({ message: 'Translation deleted' });

      await controller.deleteTranslations('dest-1', Locale.nl, mockAdminUser);

      expect(service.deleteTranslations).toHaveBeenCalledWith('dest-1', Locale.nl, 'admin-1');
    });
  });

  // ── getPageContent ───────────────────────────────────────────────────────────

  describe('getPageContent', () => {
    it('delegates to service.getPageContent with id and locale from query', async () => {
      service.getPageContent.mockResolvedValue({ locale: Locale.en });

      const query: LocaleQueryDto = { locale: Locale.en };
      await controller.getPageContent('dest-1', query);

      expect(service.getPageContent).toHaveBeenCalledWith('dest-1', Locale.en);
    });
  });

  // ── upsertPageContent ────────────────────────────────────────────────────────

  describe('upsertPageContent', () => {
    it('delegates to service.upsertPageContent with id, locale, dto, and user.id', async () => {
      service.upsertPageContent.mockResolvedValue({});

      const dto: UpsertDestinationPageContentDto = { aboutText: 'About text' };
      await controller.upsertPageContent('dest-1', Locale.en, dto, mockAdminUser);

      expect(service.upsertPageContent).toHaveBeenCalledWith('dest-1', Locale.en, dto, 'admin-1');
    });
  });

  // ── getFaqs ──────────────────────────────────────────────────────────────────

  describe('getFaqs', () => {
    it('delegates to service.getFaqs with destination id and query', async () => {
      service.getFaqs.mockResolvedValue([]);

      const query: FaqLocaleQueryDto = { locale: Locale.en };
      await controller.getFaqs('dest-1', query);

      expect(service.getFaqs).toHaveBeenCalledWith('dest-1', query);
    });
  });

  // ── createFaq ────────────────────────────────────────────────────────────────

  describe('createFaq', () => {
    it('delegates to service.createFaq with id, dto, and user.id', async () => {
      service.createFaq.mockResolvedValue({ id: 'faq-1' });

      const dto: CreateFaqDto = {
        locale: Locale.en,
        question: 'What to do in Curaçao?',
        answer: 'There are many things to enjoy year-round.',
        displayOrder: 0,
      };
      await controller.createFaq('dest-1', dto, mockAdminUser);

      expect(service.createFaq).toHaveBeenCalledWith('dest-1', dto, 'admin-1');
    });
  });

  // ── updateFaq ────────────────────────────────────────────────────────────────

  describe('updateFaq', () => {
    it('delegates to service.updateFaq with id, faqId, dto, and user.id', async () => {
      service.updateFaq.mockResolvedValue({ id: 'faq-1' });

      const dto: UpdateFaqDto = { question: 'Updated question?' };
      await controller.updateFaq('dest-1', 'faq-1', dto, mockAdminUser);

      expect(service.updateFaq).toHaveBeenCalledWith('dest-1', 'faq-1', dto, 'admin-1');
    });
  });

  // ── deleteFaq ────────────────────────────────────────────────────────────────

  describe('deleteFaq', () => {
    it('delegates to service.deleteFaq with id, faqId, and user.id', async () => {
      service.deleteFaq.mockResolvedValue({ message: 'FAQ deleted successfully' });

      await controller.deleteFaq('dest-1', 'faq-1', mockAdminUser);

      expect(service.deleteFaq).toHaveBeenCalledWith('dest-1', 'faq-1', 'admin-1');
    });

    it('returns the service result unchanged', async () => {
      const expected = { message: 'FAQ deleted successfully' };
      service.deleteFaq.mockResolvedValue(expected);

      const result = await controller.deleteFaq('dest-1', 'faq-1', mockAdminUser);

      expect(result).toEqual(expected);
    });
  });

  // ── Permission metadata ───────────────────────────────────────────────────────

  describe('permission metadata', () => {
    function getPermission(methodName: keyof DestinationController) {
      return Reflect.getMetadata('permissions', DestinationController.prototype[methodName]);
    }

    it('create endpoint requires CREATE_DESTINATION permission', () => {
      expect(getPermission('create')).toContain(Permission.CREATE_DESTINATION);
    });

    it('update endpoint requires EDIT_DESTINATION permission', () => {
      expect(getPermission('update')).toContain(Permission.EDIT_DESTINATION);
    });

    it('remove endpoint requires DELETE_DESTINATION permission', () => {
      expect(getPermission('remove')).toContain(Permission.DELETE_DESTINATION);
    });

    it('getAllTranslations endpoint requires EDIT_DESTINATION permission', () => {
      expect(getPermission('getAllTranslations')).toContain(Permission.EDIT_DESTINATION);
    });

    it('upsertTranslations endpoint requires EDIT_DESTINATION permission', () => {
      expect(getPermission('upsertTranslations')).toContain(Permission.EDIT_DESTINATION);
    });

    it('deleteTranslations endpoint requires EDIT_DESTINATION permission', () => {
      expect(getPermission('deleteTranslations')).toContain(Permission.EDIT_DESTINATION);
    });

    it('upsertPageContent endpoint requires EDIT_DESTINATION permission', () => {
      expect(getPermission('upsertPageContent')).toContain(Permission.EDIT_DESTINATION);
    });

    it('createFaq endpoint requires EDIT_DESTINATION permission', () => {
      expect(getPermission('createFaq')).toContain(Permission.EDIT_DESTINATION);
    });

    it('updateFaq endpoint requires EDIT_DESTINATION permission', () => {
      expect(getPermission('updateFaq')).toContain(Permission.EDIT_DESTINATION);
    });

    it('deleteFaq endpoint requires EDIT_DESTINATION permission', () => {
      expect(getPermission('deleteFaq')).toContain(Permission.EDIT_DESTINATION);
    });
  });

  // ── Public endpoint metadata ──────────────────────────────────────────────────

  describe('public endpoint metadata', () => {
    function isPublic(methodName: keyof DestinationController) {
      return Reflect.getMetadata('isPublic', DestinationController.prototype[methodName]);
    }

    it('getAll endpoint is marked @Public', () => {
      expect(isPublic('getAll')).toBe(true);
    });

    it('getActive endpoint is marked @Public', () => {
      expect(isPublic('getActive')).toBe(true);
    });

    it('getBySlug endpoint is marked @Public', () => {
      expect(isPublic('getBySlug')).toBe(true);
    });

    it('getById endpoint is marked @Public', () => {
      expect(isPublic('getById')).toBe(true);
    });

    it('getPageContent endpoint is marked @Public', () => {
      expect(isPublic('getPageContent')).toBe(true);
    });

    it('getFaqs endpoint is marked @Public', () => {
      expect(isPublic('getFaqs')).toBe(true);
    });
  });
});
