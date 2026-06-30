/**
 * Unit tests for CategoryController.
 *
 * CategoryService is fully mocked.  Controller tests verify that each endpoint
 * delegates to the correct service method and passes through its params/DTOs
 * unchanged.  Auth guard and Swagger decorator behaviour are integration concerns
 * and are noted with comments where relevant.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Locale } from '@prisma/client';
import { CategoryController } from './categories.controller';
import { CategoryService } from './categories.service';
import {
  CategoryQueryDto,
  CreateCategoryDto,
  CreateFaqDto,
  FaqLocaleQueryDto,
  LocaleQueryDto,
  UpdateCategoryDto,
  UpdateFaqDto,
  UpsertCategoryPageContentDto,
  UpsertCategoryTranslationsDto,
} from './dto/category.dto';

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMockCategoryService(): Record<string, jest.Mock> {
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

/** Minimal typed-auth-user shape used by controller endpoints that call user.id */
function makeAuthUser(id = 'admin-1') {
  return { id, role: 'ADMIN' } as any;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: ReturnType<typeof createMockCategoryService>;

  beforeEach(async () => {
    service = createMockCategoryService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: service }],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    jest.clearAllMocks();
  });

  // ── getAll ─────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('delegates to categoryService.getAll with the full query DTO', async () => {
      service.getAll.mockResolvedValue({
        total: 0,
        page: 1,
        limit: 20,
        data: [],
      });

      const query: CategoryQueryDto = { page: 1, limit: 20, locale: Locale.en };
      await controller.getAll(query);

      expect(service.getAll).toHaveBeenCalledWith(query);
      expect(service.getAll).toHaveBeenCalledTimes(1);
    });

    it('returns whatever categoryService.getAll returns', async () => {
      const expected = {
        total: 2,
        page: 1,
        limit: 20,
        data: ['cat-a', 'cat-b'],
      };
      service.getAll.mockResolvedValue(expected);

      const result = await controller.getAll({
        page: 1,
        limit: 20,
        locale: Locale.en,
      });

      expect(result).toEqual(expected);
    });

    // @Public() - no auth cookie required; verified by decorator presence (integration concern)
  });

  // ── getActive ──────────────────────────────────────────────────────────────

  describe('getActive', () => {
    it('delegates to categoryService.getActive with locale from query', async () => {
      service.getActive.mockResolvedValue([]);

      const query: LocaleQueryDto = { locale: Locale.nl };
      await controller.getActive(query);

      expect(service.getActive).toHaveBeenCalledWith(Locale.nl);
    });

    it('passes locale as-is from the query DTO', async () => {
      service.getActive.mockResolvedValue([]);

      const query: LocaleQueryDto = { locale: Locale.es };
      await controller.getActive(query);

      expect(service.getActive).toHaveBeenCalledWith(Locale.es);
    });
  });

  // ── getBySlug ──────────────────────────────────────────────────────────────

  describe('getBySlug', () => {
    it('delegates to categoryService.getBySlug with slug param and locale from query', async () => {
      service.getBySlug.mockResolvedValue({});

      const query: LocaleQueryDto = { locale: Locale.nl };
      await controller.getBySlug('boat-tours', query);

      expect(service.getBySlug).toHaveBeenCalledWith('boat-tours', Locale.nl);
    });
  });

  // ── getById ────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('delegates to categoryService.getById with id param and locale from query', async () => {
      service.getById.mockResolvedValue({});

      const query: LocaleQueryDto = { locale: Locale.en };
      await controller.getById('cat-uuid', query);

      expect(service.getById).toHaveBeenCalledWith('cat-uuid', Locale.en);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('delegates to categoryService.create with the dto and authenticated user id', async () => {
      service.create.mockResolvedValue({ id: 'cat-new' });

      const dto: CreateCategoryDto = { name: 'Boat Tours' };
      const user = makeAuthUser('admin-42');
      await controller.create(dto, user);

      expect(service.create).toHaveBeenCalledWith(dto, 'admin-42');
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('delegates to categoryService.update with id, dto, and user id', async () => {
      service.update.mockResolvedValue({});

      const dto: UpdateCategoryDto = { isActive: false };
      const user = makeAuthUser('admin-1');
      await controller.update('cat-1', dto, user);

      expect(service.update).toHaveBeenCalledWith('cat-1', dto, 'admin-1');
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('delegates to categoryService.remove with id and user id', async () => {
      service.remove.mockResolvedValue({
        message: 'Category deactivated successfully',
      });

      const user = makeAuthUser('admin-1');
      await controller.remove('cat-1', user);

      expect(service.remove).toHaveBeenCalledWith('cat-1', 'admin-1');
    });
  });

  // ── getAllTranslations ──────────────────────────────────────────────────────

  describe('getAllTranslations', () => {
    it('delegates to categoryService.getAllTranslations with category id', async () => {
      service.getAllTranslations.mockResolvedValue([]);

      await controller.getAllTranslations('cat-1');

      expect(service.getAllTranslations).toHaveBeenCalledWith('cat-1');
    });
  });

  // ── getTranslationsByLocale ────────────────────────────────────────────────

  describe('getTranslationsByLocale', () => {
    it('delegates to categoryService.getTranslationsByLocale with id and locale', async () => {
      service.getTranslationsByLocale.mockResolvedValue({});

      await controller.getTranslationsByLocale('cat-1', Locale.nl);

      expect(service.getTranslationsByLocale).toHaveBeenCalledWith(
        'cat-1',
        Locale.nl,
      );
    });
  });

  // ── upsertTranslations ─────────────────────────────────────────────────────

  describe('upsertTranslations', () => {
    it('delegates to categoryService.upsertTranslations with id, locale, dto, and user id', async () => {
      service.upsertTranslations.mockResolvedValue({});

      const dto: UpsertCategoryTranslationsDto = {
        fields: { name: 'Boottochten' },
        isMachineTranslated: false,
      };
      const user = makeAuthUser('admin-1');
      await controller.upsertTranslations('cat-1', Locale.nl, dto, user);

      expect(service.upsertTranslations).toHaveBeenCalledWith(
        'cat-1',
        Locale.nl,
        dto,
        'admin-1',
      );
    });
  });

  // ── deleteTranslations ─────────────────────────────────────────────────────

  describe('deleteTranslations', () => {
    it('delegates to categoryService.deleteTranslations with id, locale, and user id', async () => {
      service.deleteTranslations.mockResolvedValue({
        message: 'Translation deleted',
      });

      const user = makeAuthUser('admin-1');
      await controller.deleteTranslations('cat-1', Locale.nl, user);

      expect(service.deleteTranslations).toHaveBeenCalledWith(
        'cat-1',
        Locale.nl,
        'admin-1',
      );
    });
  });

  // ── getPageContent ─────────────────────────────────────────────────────────

  describe('getPageContent', () => {
    it('delegates to categoryService.getPageContent with id and locale from query', async () => {
      service.getPageContent.mockResolvedValue({});

      const query: LocaleQueryDto = { locale: Locale.nl };
      await controller.getPageContent('cat-1', query);

      expect(service.getPageContent).toHaveBeenCalledWith('cat-1', Locale.nl);
    });

    // @Public() - no auth required (integration concern)
  });

  // ── upsertPageContent ──────────────────────────────────────────────────────

  describe('upsertPageContent', () => {
    it('delegates to categoryService.upsertPageContent with id, locale, dto, and user id', async () => {
      service.upsertPageContent.mockResolvedValue({});

      const dto: UpsertCategoryPageContentDto = { aboutText: 'About' };
      const user = makeAuthUser('admin-1');
      await controller.upsertPageContent('cat-1', Locale.nl, dto, user);

      expect(service.upsertPageContent).toHaveBeenCalledWith(
        'cat-1',
        Locale.nl,
        dto,
        'admin-1',
      );
    });
  });

  // ── getFaqs ────────────────────────────────────────────────────────────────

  describe('getFaqs', () => {
    it('delegates to categoryService.getFaqs with id and full query DTO', async () => {
      service.getFaqs.mockResolvedValue([]);

      const query: FaqLocaleQueryDto = { locale: Locale.en };
      await controller.getFaqs('cat-1', query);

      expect(service.getFaqs).toHaveBeenCalledWith('cat-1', query);
    });

    it('passes an empty query DTO through unchanged', async () => {
      service.getFaqs.mockResolvedValue([]);

      await controller.getFaqs('cat-1', {});

      expect(service.getFaqs).toHaveBeenCalledWith('cat-1', {});
    });

    // @Public() - no auth required (integration concern)
  });

  // ── createFaq ──────────────────────────────────────────────────────────────

  describe('createFaq', () => {
    it('delegates to categoryService.createFaq with id, dto, and user id', async () => {
      service.createFaq.mockResolvedValue({});

      const dto: CreateFaqDto = {
        locale: Locale.en,
        question: 'What is included?',
        answer: 'A life jacket and snorkeling gear.',
        displayOrder: 0,
      };
      const user = makeAuthUser('admin-1');
      await controller.createFaq('cat-1', dto, user);

      expect(service.createFaq).toHaveBeenCalledWith('cat-1', dto, 'admin-1');
    });
  });

  // ── updateFaq ──────────────────────────────────────────────────────────────

  describe('updateFaq', () => {
    it('delegates to categoryService.updateFaq with id, faqId, dto, and user id', async () => {
      service.updateFaq.mockResolvedValue({});

      const dto: UpdateFaqDto = { question: 'Is food included?' };
      const user = makeAuthUser('admin-1');
      await controller.updateFaq('cat-1', 'faq-1', dto, user);

      expect(service.updateFaq).toHaveBeenCalledWith(
        'cat-1',
        'faq-1',
        dto,
        'admin-1',
      );
    });
  });

  // ── deleteFaq ──────────────────────────────────────────────────────────────

  describe('deleteFaq', () => {
    it('delegates to categoryService.deleteFaq with id, faqId, and user id', async () => {
      service.deleteFaq.mockResolvedValue({
        message: 'FAQ deleted successfully',
      });

      const user = makeAuthUser('admin-1');
      await controller.deleteFaq('cat-1', 'faq-1', user);

      expect(service.deleteFaq).toHaveBeenCalledWith(
        'cat-1',
        'faq-1',
        'admin-1',
      );
    });

    it('returns the service result unchanged', async () => {
      const expected = { message: 'FAQ deleted successfully' };
      service.deleteFaq.mockResolvedValue(expected);

      const user = makeAuthUser('admin-1');
      const result = await controller.deleteFaq('cat-1', 'faq-1', user);

      expect(result).toEqual(expected);
    });
  });
});
