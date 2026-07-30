import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { PrismaService } from '@/prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Currency, Locale, Prisma } from '@prisma/client';
import { HotelsService } from './hotels.service';

function createMockPrismaService() {
  return {
    hotel: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    hotelTranslation: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
  };
}

const SEEDED_ID = 'hotel-seeded';

/**
 * Explicitly typed so an override can widen a field to null or another locale.
 * Inferred from the literal, `title: 'Palm Suite Apartment'` narrows to that
 * exact string and every `{ title: null }` case fails to compile.
 */
interface TranslationMock {
  locale: Locale;
  eyebrow: string | null;
  areaLabel: string | null;
  title: string | null;
  description: string | null;
  ctaLabel: string | null;
  isMachineTranslated: boolean;
}

/** A complete hotel: the values the card used to hardcode on the frontend. */
function hotel(
  overrides: Record<string, unknown> = {},
  translations: TranslationMock[] = [english()],
) {
  return {
    id: SEEDED_ID,
    isEnabled: true,
    displayOrder: 0,
    isSeeded: true,
    imageUrl: 'https://cdn.example.com/palm-suite.jpg',
    bookingUrl: 'https://www.airbnb.com',
    rating: new Prisma.Decimal('4.8'),
    reviewCount: 1738,
    sleeps: 4,
    pricePerNight: new Prisma.Decimal('160.00'),
    currency: Currency.USD,
    translations,
    ...overrides,
  };
}

function english(overrides: Partial<TranslationMock> = {}): TranslationMock {
  return {
    locale: Locale.en,
    eyebrow: null,
    areaLabel: 'Jan Thiel',
    title: 'Palm Suite Apartment',
    description:
      'Quiet, modern, 5min from the beach\nOwned and hosted by Island Tours',
    ctaLabel: null,
    isMachineTranslated: false,
    ...overrides,
  };
}

describe('HotelsService', () => {
  let service: HotelsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let enqueuer: { enqueue: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    enqueuer = { enqueue: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HotelsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContentTranslationEnqueuer, useValue: enqueuer },
      ],
    }).compile();

    service = module.get<HotelsService>(HotelsService);
    jest.clearAllMocks();
    prisma.hotel.findMany.mockResolvedValue([]);
  });

  // ── Public read ─────────────────────────────────────────────────────────────

  describe('getPublic', () => {
    it('projects the promoted hotel onto the card shape', async () => {
      prisma.hotel.findMany.mockResolvedValue([hotel()]);

      const result = await service.getPublic(Locale.en);

      expect(result).toEqual({
        enabled: true,
        locale: Locale.en,
        imageUrl: 'https://cdn.example.com/palm-suite.jpg',
        bookingUrl: 'https://www.airbnb.com',
        rating: 4.8,
        reviewCount: 1738,
        sleeps: 4,
        pricePerNight: 160,
        currency: Currency.USD,
        eyebrow: null,
        areaLabel: 'Jan Thiel',
        title: 'Palm Suite Apartment',
        descriptionLines: [
          'Quiet, modern, 5min from the beach',
          'Owned and hosted by Island Tours',
        ],
        ctaLabel: null,
      });
    });

    /**
     * Decimals must cross the wire as numbers. Prisma hands them back as Decimal
     * objects that serialize to JSON as STRINGS, and the card formats them -
     * `"4.8"` would render and sort differently from 4.8.
     */
    it('converts Decimal columns to numbers', async () => {
      prisma.hotel.findMany.mockResolvedValue([hotel()]);

      const result = await service.getPublic(Locale.en);

      expect(typeof result.rating).toBe('number');
      expect(typeof result.pricePerNight).toBe('number');
    });

    it('only ever considers enabled hotels', async () => {
      await service.getPublic(Locale.en);

      expect(prisma.hotel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isEnabled: true } }),
      );
    });

    it('reads them in promotion order: displayOrder, then id', async () => {
      await service.getPublic(Locale.en);

      expect(prisma.hotel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    /**
     * THE POINT OF THE LIST: the first hotel wins, and the rest are simply not on
     * the site. The page renders one card.
     */
    it('promotes the first hotel and ignores the rest', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({ id: 'a', displayOrder: 0 }),
        hotel({ id: 'b', displayOrder: 1 }, [
          english({ title: 'Second Place' }),
        ]),
      ]);

      const result = await service.getPublic(Locale.en);

      expect(result.title).toBe('Palm Suite Apartment');
    });

    /**
     * An incomplete hotel is SKIPPED, not fatal. Ending the search at the first
     * enabled row would let a half-filled draft sitting at displayOrder 0
     * silently suppress the perfectly good hotel behind it - the section would
     * vanish and the cause would be invisible.
     */
    it.each([
      ['has no image', { imageUrl: null }],
      ['has no booking link', { bookingUrl: null }],
    ])('skips past a hotel that %s', async (_case, broken) => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({ id: 'broken', displayOrder: 0, ...broken }),
        hotel({ id: 'good', displayOrder: 1 }, [
          english({ title: 'The Good One' }),
        ]),
      ]);

      const result = await service.getPublic(Locale.en);

      expect(result.enabled).toBe(true);
      expect(result.title).toBe('The Good One');
    });

    it('skips past a hotel with no English title', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({ id: 'untitled', displayOrder: 0 }, [english({ title: null })]),
        hotel({ id: 'good', displayOrder: 1 }, [
          english({ title: 'The Good One' }),
        ]),
      ]);

      const result = await service.getPublic(Locale.en);

      expect(result.title).toBe('The Good One');
    });

    /**
     * A whitespace-only title is the same nothing as a null one. Without the trim
     * the gate would pass and the card would render a blank heading.
     */
    it('treats a whitespace-only title as missing', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({}, [english({ title: '   ' })]),
      ]);

      const result = await service.getPublic(Locale.en);

      expect(result.enabled).toBe(false);
    });

    // The hidden payload must null EVERYTHING, not merely flip the flag, so a
    // frontend that ignores the flag renders nothing rather than leaking a
    // half-configured promo.

    it('hides the section when no hotel qualifies', async () => {
      prisma.hotel.findMany.mockResolvedValue([hotel({ imageUrl: null })]);

      const result = await service.getPublic(Locale.en);

      expect(result.enabled).toBe(false);
      expect(result.imageUrl).toBeNull();
      expect(result.title).toBeNull();
      expect(result.bookingUrl).toBeNull();
      expect(result.descriptionLines).toEqual([]);
    });

    it('hides the section when there are no hotels at all', async () => {
      prisma.hotel.findMany.mockResolvedValue([]);

      const result = await service.getPublic(Locale.en);

      expect(result.enabled).toBe(false);
      // Still a real currency: the frontend types this as an enum, not a maybe.
      expect(result.currency).toBe(Currency.USD);
    });

    // ── Locale handling ───────────────────────────────────────────────────────

    it('reads the requested locale and English, so fields can fall back', async () => {
      await service.getPublic(Locale.nl);

      expect(prisma.hotel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            translations: expect.objectContaining({
              where: { locale: { in: [Locale.nl, Locale.en] } },
            }),
          }),
        }),
      );
    });

    /**
     * PER-FIELD fallback, not per-row: a Dutch row that translated the title but
     * not the pitch must show the Dutch title next to the ENGLISH pitch, never a
     * missing paragraph.
     */
    it('falls back to English for the fields a locale leaves blank', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({}, [
          english(),
          {
            locale: Locale.nl,
            eyebrow: null,
            areaLabel: null,
            title: 'Palm Suite Appartement',
            description: null,
            ctaLabel: null,
            isMachineTranslated: true,
          },
        ]),
      ]);

      const result = await service.getPublic(Locale.nl);

      expect(result.title).toBe('Palm Suite Appartement');
      expect(result.areaLabel).toBe('Jan Thiel');
      expect(result.descriptionLines).toEqual([
        'Quiet, modern, 5min from the beach',
        'Owned and hosted by Island Tours',
      ]);
    });

    // ── Description splitting ─────────────────────────────────────────────────

    it('drops blank lines so a trailing return renders no empty paragraph', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({}, [english({ description: 'One line\n\n  \nSecond line\n' })]),
      ]);

      const result = await service.getPublic(Locale.en);

      expect(result.descriptionLines).toEqual(['One line', 'Second line']);
    });

    it('returns no lines when there is no description', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({}, [english({ description: null })]),
      ]);

      const result = await service.getPublic(Locale.en);

      expect(result.descriptionLines).toEqual([]);
    });
  });

  // ── Admin list ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('marks exactly one hotel as promoted', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({ id: 'a', displayOrder: 0 }),
        hotel({ id: 'b', displayOrder: 1 }),
      ]);

      const result = await service.findAll();

      expect(result.map((h) => h.isPromoted)).toEqual([true, false]);
      // Both are perfectly valid hotels - only one reaches the site.
      expect(result.map((h) => h.isComplete)).toEqual([true, true]);
    });

    /**
     * The editor has to state what the site is DOING, or an admin who saves a
     * hotel with no booking link never finds out it did not ship.
     */
    it('promotes the first COMPLETE hotel, not simply the first', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({ id: 'broken', displayOrder: 0, bookingUrl: null }),
        hotel({ id: 'good', displayOrder: 1 }),
      ]);

      const result = await service.findAll();

      expect(result[0]).toMatchObject({ isPromoted: false, isComplete: false });
      expect(result[1]).toMatchObject({ isPromoted: true, isComplete: true });
    });

    it('never promotes a switched-off hotel, however complete', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({ id: 'off', displayOrder: 0, isEnabled: false }),
        hotel({ id: 'on', displayOrder: 1 }),
      ]);

      const result = await service.findAll();

      // Complete but off: it COULD be promoted, it just is not.
      expect(result[0]).toMatchObject({ isPromoted: false, isComplete: true });
      expect(result[1].isPromoted).toBe(true);
    });

    it('promotes nobody when every hotel is incomplete', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({ id: 'a', imageUrl: null }),
        hotel({ id: 'b', bookingUrl: null }),
      ]);

      const result = await service.findAll();

      expect(result.every((h) => !h.isPromoted)).toBe(true);
    });

    it('converts Decimals for the editor too', async () => {
      prisma.hotel.findMany.mockResolvedValue([hotel()]);

      const result = await service.findAll();

      expect(result[0].rating).toBe(4.8);
      expect(result[0].pricePerNight).toBe(160);
    });

    /**
     * `isComplete` is judged on ENGLISH, because English is what every other
     * locale falls back to: a Dutch-only title would leave six locales unnamed.
     */
    it('judges completeness on the English title, not any other locale', async () => {
      prisma.hotel.findMany.mockResolvedValue([
        hotel({}, [
          english({ title: null }),
          { ...english(), locale: Locale.nl },
        ]),
      ]);

      const result = await service.findAll();

      expect(result[0].isComplete).toBe(false);
    });
  });

  describe('findOne', () => {
    it('404s on an unknown id', async () => {
      prisma.hotel.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });

    /**
     * Whether THIS hotel is promoted depends on the OTHERS - a complete hotel
     * ahead of it in promotion order takes the card - so the detail read cannot
     * answer from its own row alone.
     */
    it('reports isPromoted false when another hotel is ahead of it', async () => {
      prisma.hotel.findUnique.mockResolvedValue(hotel({ id: 'b' }));
      prisma.hotel.findMany.mockResolvedValue([
        hotel({ id: 'a', displayOrder: 0, translations: [english()] }),
        hotel({ id: 'b', displayOrder: 1, translations: [english()] }),
      ]);

      const result = await service.findOne('b');

      expect(result.isPromoted).toBe(false);
      expect(result.isComplete).toBe(true);
    });

    it('reports isPromoted true when it is the one on the site', async () => {
      prisma.hotel.findUnique.mockResolvedValue(hotel({ id: 'a' }));
      prisma.hotel.findMany.mockResolvedValue([
        hotel({ id: 'a', displayOrder: 0, translations: [english()] }),
      ]);

      const result = await service.findOne('a');

      expect(result.isPromoted).toBe(true);
    });
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      prisma.hotel.create.mockResolvedValue({ id: 'new-hotel' });
      prisma.hotel.findUnique.mockResolvedValue(hotel({ id: 'new-hotel' }));
      prisma.hotel.findMany.mockResolvedValue([hotel({ id: 'new-hotel' })]);
    });

    /**
     * The English row is written WITH the hotel, not by a follow-up request: the
     * title is part of the render gate and the only label the list can show, so a
     * hotel with no translation row is one an admin cannot identify and the site
     * can never promote.
     */
    it('writes the English copy in the same call as the row', async () => {
      await service.create(
        { title: 'New Place', areaLabel: 'Pietermaai' },
        'a1',
      );

      expect(prisma.hotel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            translations: {
              create: expect.objectContaining({
                locale: Locale.en,
                title: 'New Place',
                areaLabel: 'Pietermaai',
              }),
            },
          }),
        }),
      );
    });

    it('does not write the copy fields onto the hotel row itself', async () => {
      await service.create({ title: 'New Place', sleeps: 2 }, 'a1');

      const call = prisma.hotel.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).toHaveProperty('sleeps', 2);
      expect(call.data).not.toHaveProperty('title');
      expect(call.data).not.toHaveProperty('areaLabel');
    });

    it('queues the new English copy for translation', async () => {
      await service.create({ title: 'New Place' }, 'a1');

      expect(enqueuer.enqueue).toHaveBeenCalledWith('hotel', 'new-hotel');
    });
  });

  // ── Update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    beforeEach(() => {
      prisma.hotel.findUnique.mockResolvedValue(hotel());
      prisma.hotel.update.mockResolvedValue({ id: SEEDED_ID });
      prisma.hotel.findMany.mockResolvedValue([hotel()]);
    });

    it('404s on an unknown id', async () => {
      prisma.hotel.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { sleeps: 6 }, 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('touches only the fields the PATCH names', async () => {
      await service.update(SEEDED_ID, { sleeps: 6 }, 'a1');

      expect(prisma.hotel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { sleeps: 6 } }),
      );
    });

    /**
     * An explicit null is a CLEAR, and has to reach the database as one. Treating
     * it like an absent field (the `if (dto.x)` shape) would make the image
     * impossible to remove - the one edit that takes a hotel out of the running.
     */
    it('clears a field on an explicit null', async () => {
      await service.update(SEEDED_ID, { imageUrl: null }, 'a1');

      expect(prisma.hotel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { imageUrl: null } }),
      );
    });

    it('writes nothing for an empty PATCH', async () => {
      await service.update(SEEDED_ID, {}, 'a1');

      expect(prisma.hotel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: {} }),
      );
    });

    it('answers with the recomputed gate, not the submitted values', async () => {
      prisma.hotel.findUnique.mockResolvedValue(hotel({ imageUrl: null }));
      prisma.hotel.findMany.mockResolvedValue([hotel({ imageUrl: null })]);

      const result = await service.update(SEEDED_ID, { imageUrl: null }, 'a1');

      expect(result.isPromoted).toBe(false);
      expect(result.isComplete).toBe(false);
    });
  });

  // ── Delete, and the seed protection ─────────────────────────────────────────

  describe('remove', () => {
    it('404s on an unknown id', async () => {
      prisma.hotel.findUnique.mockResolvedValue(null);

      await expect(service.remove('nope', 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });

    /**
     * The seed protection, same contract as `Destination.isSeeded`: it keeps the
     * promo with one guaranteed occupant, so the section can only be emptied
     * deliberately (by switching hotels off) and never by an accidental delete.
     */
    it('refuses to delete a seeded hotel', async () => {
      prisma.hotel.findUnique.mockResolvedValue({
        id: SEEDED_ID,
        isSeeded: true,
      });

      await expect(service.remove(SEEDED_ID, 'a1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.hotel.delete).not.toHaveBeenCalled();
    });

    it('deletes a hotel that is not seeded', async () => {
      prisma.hotel.findUnique.mockResolvedValue({
        id: 'added-later',
        isSeeded: false,
      });

      await service.remove('added-later', 'a1');

      expect(prisma.hotel.delete).toHaveBeenCalledWith({
        where: { id: 'added-later' },
      });
    });
  });

  // ── Translations ────────────────────────────────────────────────────────────

  describe('upsertTranslation', () => {
    beforeEach(() => {
      prisma.hotel.findUnique.mockResolvedValue({ id: SEEDED_ID });
      prisma.hotelTranslation.upsert.mockResolvedValue(english());
    });

    it('404s on an unknown hotel rather than writing an orphan row', async () => {
      prisma.hotel.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertTranslation(
          'nope',
          Locale.nl,
          { fields: { title: 'x' } },
          'a1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.hotelTranslation.upsert).not.toHaveBeenCalled();
    });

    it('keys the row on this hotel and locale', async () => {
      await service.upsertTranslation(
        SEEDED_ID,
        Locale.nl,
        { fields: { title: 'Palm Suite Appartement' } },
        'a1',
      );

      expect(prisma.hotelTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hotelId_locale: { hotelId: SEEDED_ID, locale: Locale.nl } },
        }),
      );
    });

    /**
     * A human edit must clear `sourceHash`, or the AI refresher reads the row as
     * still matching the English it was generated from and overwrites what was
     * just typed.
     */
    it('resets the AI bookkeeping on a human write', async () => {
      await service.upsertTranslation(
        SEEDED_ID,
        Locale.nl,
        { fields: { title: 'Palm Suite Appartement' } },
        'a1',
      );

      expect(prisma.hotelTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            sourceHash: null,
            isMachineTranslated: false,
          }),
        }),
      );
    });

    it('re-sources the other locales after an English edit', async () => {
      await service.upsertTranslation(
        SEEDED_ID,
        Locale.en,
        { fields: { title: 'Palm Suite Apartment' } },
        'a1',
      );

      expect(enqueuer.enqueue).toHaveBeenCalledWith('hotel', SEEDED_ID);
    });

    it('does not re-source anything after a non-English edit', async () => {
      await service.upsertTranslation(
        SEEDED_ID,
        Locale.nl,
        { fields: { title: 'Palm Suite Appartement' } },
        'a1',
      );

      expect(enqueuer.enqueue).not.toHaveBeenCalled();
    });

    it('leaves unnamed fields alone', async () => {
      await service.upsertTranslation(
        SEEDED_ID,
        Locale.en,
        { fields: { areaLabel: 'Pietermaai' } },
        'a1',
      );

      const call = prisma.hotelTranslation.upsert.mock.calls[0][0] as {
        update: Record<string, unknown>;
      };
      expect(call.update).toHaveProperty('areaLabel', 'Pietermaai');
      expect(call.update).not.toHaveProperty('title');
    });
  });
});
