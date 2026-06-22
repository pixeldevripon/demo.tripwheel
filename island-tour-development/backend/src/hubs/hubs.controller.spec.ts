/**
 * Unit tests for HubController.
 *
 * The controller is kept intentionally thin - it does no business logic.
 * These tests confirm that each route handler:
 *   1. Calls the correct HubService method.
 *   2. Passes the params, query, and body values through unchanged.
 *   3. Returns the service return value directly.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HubType, Locale } from '@prisma/client';
import type { TypedAuthUser } from '@/auth/auth.types';
import {
  ActiveHubsQueryDto,
  AddAllowedCategoryDto,
  CreateFaqDto,
  CreateHubDto,
  FaqLocaleQueryDto,
  HubBySlugQueryDto,
  HubQueryDto,
  LocaleQueryDto,
  UpdateFaqDto,
  UpdateHubDto,
  UpsertHubPageContentDto,
  UpsertHubTranslationsDto,
} from './dto/hub.dto';
import { HubController } from './hubs.controller';
import { HubService } from './hubs.service';

// ── Mock factory ─────────────────────────────────────────────────────────────

function createMockHubService(): jest.Mocked<HubService> {
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
    getAllowedCategories: jest.fn(),
    addAllowedCategory: jest.fn(),
    removeAllowedCategory: jest.fn(),
  } as unknown as jest.Mocked<HubService>;
}

function makeAuthUser(overrides: Partial<TypedAuthUser> = {}): TypedAuthUser {
  return {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'ADMIN',
    ...overrides,
  } as TypedAuthUser;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('HubController', () => {
  let controller: HubController;
  let service: jest.Mocked<HubService>;

  beforeEach(async () => {
    service = createMockHubService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HubController],
      providers: [{ provide: HubService, useValue: service }],
    }).compile();

    controller = module.get<HubController>(HubController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── Public list / lookup ──────────────────────────────────────────────────────

  describe('getAll', () => {
    it('delegates to hubService.getAll with the query object', async () => {
      const expected = { total: 1, page: 1, limit: 20, data: [] };
      service.getAll.mockResolvedValue(expected as any);

      const query: HubQueryDto = { page: 1, limit: 20, locale: Locale.en };
      const result = await controller.getAll(query);

      expect(service.getAll).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });

  describe('getActive', () => {
    it('delegates to hubService.getActive with the query object', async () => {
      service.getActive.mockResolvedValue([]);

      const query: ActiveHubsQueryDto = { locale: Locale.en };
      const result = await controller.getActive(query);

      expect(service.getActive).toHaveBeenCalledWith(query);
      expect(result).toEqual([]);
    });
  });

  describe('getBySlug', () => {
    it('delegates to hubService.getBySlug with the slug param and query', async () => {
      const expected = { id: 'hub-1', slug: 'klein-curacao' };
      service.getBySlug.mockResolvedValue(expected as any);

      const query: HubBySlugQueryDto = { destinationSlug: 'curacao', locale: Locale.en };
      const result = await controller.getBySlug('klein-curacao', query);

      expect(service.getBySlug).toHaveBeenCalledWith('klein-curacao', query);
      expect(result).toBe(expected);
    });
  });

  describe('getById', () => {
    it('delegates to hubService.getById with id and locale from query', async () => {
      const expected = { id: 'hub-1', name: 'Klein Curaçao' };
      service.getById.mockResolvedValue(expected as any);

      const query: LocaleQueryDto = { locale: Locale.nl };
      const result = await controller.getById('hub-1', query);

      expect(service.getById).toHaveBeenCalledWith('hub-1', Locale.nl);
      expect(result).toBe(expected);
    });
  });

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('delegates to hubService.create with dto and user.id', async () => {
      const expected = { id: 'hub-new', name: 'Klein Curaçao' };
      service.create.mockResolvedValue(expected as any);

      const dto: CreateHubDto = { destinationId: 'dest-1', name: 'Klein Curaçao', hubType: HubType.LOCATION };
      const user = makeAuthUser({ id: 'admin-1' });
      const result = await controller.create(dto, user);

      expect(service.create).toHaveBeenCalledWith(dto, 'admin-1');
      expect(result).toBe(expected);
    });
  });

  describe('update', () => {
    it('delegates to hubService.update with id, dto, and user.id', async () => {
      const expected = { id: 'hub-1', name: 'Updated' };
      service.update.mockResolvedValue(expected as any);

      const dto: UpdateHubDto = { name: 'Updated' };
      const user = makeAuthUser({ id: 'admin-2' });
      const result = await controller.update('hub-1', dto, user);

      expect(service.update).toHaveBeenCalledWith('hub-1', dto, 'admin-2');
      expect(result).toBe(expected);
    });
  });

  describe('remove', () => {
    it('delegates to hubService.remove with id and user.id', async () => {
      const expected = { message: 'Hub deactivated successfully' };
      service.remove.mockResolvedValue(expected);

      const user = makeAuthUser({ id: 'admin-3' });
      const result = await controller.remove('hub-1', user);

      expect(service.remove).toHaveBeenCalledWith('hub-1', 'admin-3');
      expect(result).toBe(expected);
    });
  });

  // ── Translation management ────────────────────────────────────────────────────

  describe('getAllTranslations', () => {
    it('delegates to hubService.getAllTranslations with hub id', async () => {
      service.getAllTranslations.mockResolvedValue([]);

      const result = await controller.getAllTranslations('hub-1');

      expect(service.getAllTranslations).toHaveBeenCalledWith('hub-1');
      expect(result).toEqual([]);
    });
  });

  describe('getTranslationsByLocale', () => {
    it('delegates to hubService.getTranslationsByLocale with id and locale', async () => {
      const expected = { locale: Locale.nl, name: 'Klein (NL)' };
      service.getTranslationsByLocale.mockResolvedValue(expected as any);

      const result = await controller.getTranslationsByLocale('hub-1', Locale.nl);

      expect(service.getTranslationsByLocale).toHaveBeenCalledWith('hub-1', Locale.nl);
      expect(result).toBe(expected);
    });
  });

  describe('upsertTranslations', () => {
    it('delegates to hubService.upsertTranslations with all params including user.id', async () => {
      const expected = { locale: Locale.nl, name: 'Klein (NL)' };
      service.upsertTranslations.mockResolvedValue(expected as any);

      const dto: UpsertHubTranslationsDto = { fields: { name: 'Klein (NL)' }, isMachineTranslated: false };
      const user = makeAuthUser({ id: 'admin-4' });
      const result = await controller.upsertTranslations('hub-1', Locale.nl, dto, user);

      expect(service.upsertTranslations).toHaveBeenCalledWith('hub-1', Locale.nl, dto, 'admin-4');
      expect(result).toBe(expected);
    });
  });

  describe('deleteTranslations', () => {
    it('delegates to hubService.deleteTranslations with id, locale, and user.id', async () => {
      const expected = { message: 'Translation for locale "nl" deleted' };
      service.deleteTranslations.mockResolvedValue(expected);

      const user = makeAuthUser({ id: 'admin-5' });
      const result = await controller.deleteTranslations('hub-1', Locale.nl, user);

      expect(service.deleteTranslations).toHaveBeenCalledWith('hub-1', Locale.nl, 'admin-5');
      expect(result).toBe(expected);
    });
  });

  // ── Page Content ──────────────────────────────────────────────────────────────

  describe('getPageContent', () => {
    it('delegates to hubService.getPageContent with id and locale from query', async () => {
      const expected = { locale: Locale.en, aboutText: 'About.', metaTitle: null, metaDescription: null };
      service.getPageContent.mockResolvedValue(expected);

      const query: LocaleQueryDto = { locale: Locale.en };
      const result = await controller.getPageContent('hub-1', query);

      expect(service.getPageContent).toHaveBeenCalledWith('hub-1', Locale.en);
      expect(result).toBe(expected);
    });
  });

  describe('upsertPageContent', () => {
    it('delegates to hubService.upsertPageContent with all params', async () => {
      const expected = { locale: Locale.en, aboutText: 'About.' };
      service.upsertPageContent.mockResolvedValue(expected as any);

      const dto: UpsertHubPageContentDto = { aboutText: 'About.' };
      const user = makeAuthUser({ id: 'admin-6' });
      const result = await controller.upsertPageContent('hub-1', Locale.en, dto, user);

      expect(service.upsertPageContent).toHaveBeenCalledWith('hub-1', Locale.en, dto, 'admin-6');
      expect(result).toBe(expected);
    });
  });

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  describe('getFaqs', () => {
    it('delegates to hubService.getFaqs with id and query', async () => {
      const expected = [{ id: 'faq-1', question: 'Q', answer: 'A' }];
      service.getFaqs.mockResolvedValue(expected as any);

      const query: FaqLocaleQueryDto = { locale: Locale.en };
      const result = await controller.getFaqs('hub-1', query);

      expect(service.getFaqs).toHaveBeenCalledWith('hub-1', query);
      expect(result).toBe(expected);
    });
  });

  describe('createFaq', () => {
    it('delegates to hubService.createFaq with hub id, dto, and user.id', async () => {
      const expected = { id: 'faq-new', question: 'What should I bring?' };
      service.createFaq.mockResolvedValue(expected as any);

      const dto: CreateFaqDto = {
        locale: Locale.en,
        question: 'What should I bring?',
        answer: 'Bring sunscreen and water.',
      };
      const user = makeAuthUser({ id: 'admin-7' });
      const result = await controller.createFaq('hub-1', dto, user);

      expect(service.createFaq).toHaveBeenCalledWith('hub-1', dto, 'admin-7');
      expect(result).toBe(expected);
    });
  });

  describe('updateFaq', () => {
    it('delegates to hubService.updateFaq with hub id, faq id, dto, and user.id', async () => {
      const expected = { id: 'faq-1', question: 'Updated?' };
      service.updateFaq.mockResolvedValue(expected as any);

      const dto: UpdateFaqDto = { question: 'Updated?' };
      const user = makeAuthUser({ id: 'admin-8' });
      const result = await controller.updateFaq('hub-1', 'faq-1', dto, user);

      expect(service.updateFaq).toHaveBeenCalledWith('hub-1', 'faq-1', dto, 'admin-8');
      expect(result).toBe(expected);
    });
  });

  describe('deleteFaq', () => {
    it('delegates to hubService.deleteFaq with hub id, faq id, and user.id', async () => {
      const expected = { message: 'FAQ deleted successfully' };
      service.deleteFaq.mockResolvedValue(expected);

      const user = makeAuthUser({ id: 'admin-9' });
      const result = await controller.deleteFaq('hub-1', 'faq-1', user);

      expect(service.deleteFaq).toHaveBeenCalledWith('hub-1', 'faq-1', 'admin-9');
      expect(result).toBe(expected);
    });
  });

  // ── Allowed categories ────────────────────────────────────────────────────────

  describe('getAllowedCategories', () => {
    it('delegates to hubService.getAllowedCategories with hub id', async () => {
      const expected = [{ id: 'hac-1', categoryId: 'cat-1' }];
      service.getAllowedCategories.mockResolvedValue(expected as any);

      const result = await controller.getAllowedCategories('hub-1');

      expect(service.getAllowedCategories).toHaveBeenCalledWith('hub-1');
      expect(result).toBe(expected);
    });
  });

  describe('addAllowedCategory', () => {
    it('delegates to hubService.addAllowedCategory with hub id, dto, and user.id', async () => {
      const expected = { message: 'Allowed category added successfully', allowedCategory: {} };
      service.addAllowedCategory.mockResolvedValue(expected as any);

      const dto: AddAllowedCategoryDto = { categoryId: 'cat-1' };
      const user = makeAuthUser({ id: 'admin-10' });
      const result = await controller.addAllowedCategory('hub-1', dto, user);

      expect(service.addAllowedCategory).toHaveBeenCalledWith('hub-1', dto, 'admin-10');
      expect(result).toBe(expected);
    });
  });

  describe('removeAllowedCategory', () => {
    it('delegates to hubService.removeAllowedCategory with hub id, category id, and user.id', async () => {
      const expected = { message: 'Allowed category removed successfully' };
      service.removeAllowedCategory.mockResolvedValue(expected);

      const user = makeAuthUser({ id: 'admin-11' });
      const result = await controller.removeAllowedCategory('hub-1', 'cat-1', user);

      expect(service.removeAllowedCategory).toHaveBeenCalledWith('hub-1', 'cat-1', 'admin-11');
      expect(result).toBe(expected);
    });
  });
});
