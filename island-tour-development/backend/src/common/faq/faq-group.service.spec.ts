import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FaqPageType, Locale } from '@prisma/client';
import { FaqGroupService } from './faq-group.service';

/**
 * Covers the Translation Console's "clear" path (founder policy 2026-07-28).
 * `Faq.question`/`answer` are NOT NULL, so a blank translation cannot be
 * stored - clearing MUST delete that locale's row so the public page falls
 * back to English, and English itself must never be deletable this way.
 */

/** Clear marks are fire-and-forget bookkeeping - stubbed everywhere. */
const clearMarks = () => ({
  mark: jest.fn().mockResolvedValue(undefined),
  markForPageType: jest.fn().mockResolvedValue(undefined),
});

function makeService(faq: Record<string, jest.Mock>) {
  const prisma = { faq } as never;
  const enqueuer = {
    enqueue: jest.fn(),
    enqueueForPageType: jest.fn(),
  } as never;
  return new FaqGroupService(prisma, enqueuer, clearMarks() as never);
}

const existingGroup = [
  {
    id: 'row-en',
    locale: Locale.en,
    question: 'What should I bring?',
    answer: 'Sunscreen and water.',
    displayOrder: 0,
    isActive: true,
    faqGroupId: 'g1',
  },
];

describe('FaqGroupService.upsertTranslation - per-field clears', () => {
  const group = [
    {
      id: 'row-en',
      locale: Locale.en,
      question: 'What should I bring?',
      answer: 'Sunscreen and water.',
      displayOrder: 2,
      isActive: true,
      faqGroupId: 'g1',
    },
    {
      id: 'row-nl',
      locale: Locale.nl,
      question: 'Wat moet ik meenemen?',
      answer: 'Zonnebrand en water.',
      displayOrder: 2,
      isActive: true,
      faqGroupId: 'g1',
    },
  ];

  it("stores a cleared question as '' and KEEPS the row", async () => {
    // The row has to survive: it is what marks the translation human (so the
    // AI leaves it alone) and what carries the still-translated answer. The
    // public read fills the blank question from English.
    const faq = {
      findMany: jest.fn().mockResolvedValue(group),
      update: jest.fn().mockResolvedValue(group[1]),
      create: jest.fn(),
      deleteMany: jest.fn(),
    };
    const service = makeService(faq);

    await service.upsertTranslation(FaqPageType.hub, 'h1', 'g1', Locale.nl, {
      question: '   ',
      answer: 'Zonnebrand en water.',
    });

    expect(faq.deleteMany).not.toHaveBeenCalled();
    expect(faq.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'row-nl' },
        data: expect.objectContaining({
          question: '',
          answer: 'Zonnebrand en water.',
          isMachineTranslated: false,
          sourceHash: null,
        }),
      }),
    );
  });

  it('accepts BOTH fields cleared - two cleared fields, still one row', async () => {
    const faq = {
      findMany: jest.fn().mockResolvedValue(group),
      update: jest.fn().mockResolvedValue(group[1]),
      create: jest.fn(),
      deleteMany: jest.fn(),
    };
    const service = makeService(faq);

    await service.upsertTranslation(FaqPageType.hub, 'h1', 'g1', Locale.nl, {
      question: '',
      answer: '',
    });

    expect(faq.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ question: '', answer: '' }),
      }),
    );
  });

  it('refuses to blank English - it is what every locale falls back to', async () => {
    const faq = {
      findMany: jest.fn().mockResolvedValue(group),
      update: jest.fn(),
      create: jest.fn(),
    };
    const service = makeService(faq);

    await expect(
      service.upsertTranslation(FaqPageType.hub, 'h1', 'g1', Locale.en, {
        question: '',
        answer: 'Sunscreen and water.',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(faq.update).not.toHaveBeenCalled();
  });
});

describe('FaqGroupService.deleteTranslation', () => {
  it('deletes ONLY the requested locale row of the group', async () => {
    const faq = {
      findMany: jest.fn().mockResolvedValue(existingGroup),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const service = makeService(faq);

    const res = await service.deleteTranslation(
      FaqPageType.hub,
      'h1',
      'g1',
      Locale.nl,
    );

    expect(faq.deleteMany).toHaveBeenCalledWith({
      where: {
        pageType: FaqPageType.hub,
        entityId: 'h1',
        faqGroupId: 'g1',
        locale: Locale.nl,
      },
    });
    expect(res.message).toBe('Translation cleared');
  });

  it('refuses to clear English - it is the source every locale derives from', async () => {
    const faq = {
      findMany: jest.fn().mockResolvedValue(existingGroup),
      deleteMany: jest.fn(),
    };
    const service = makeService(faq);

    await expect(
      service.deleteTranslation(FaqPageType.hub, 'h1', 'g1', Locale.en),
    ).rejects.toThrow(BadRequestException);
    expect(faq.deleteMany).not.toHaveBeenCalled();
  });

  it('404s for a group that does not exist on this entity', async () => {
    const faq = {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn(),
    };
    const service = makeService(faq);

    await expect(
      service.deleteTranslation(FaqPageType.hub, 'h1', 'nope', Locale.nl),
    ).rejects.toThrow(NotFoundException);
    expect(faq.deleteMany).not.toHaveBeenCalled();
  });

  it('is idempotent - clearing an already-absent translation succeeds', async () => {
    const faq = {
      findMany: jest.fn().mockResolvedValue(existingGroup),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const service = makeService(faq);

    const res = await service.deleteTranslation(
      FaqPageType.hub,
      'h1',
      'g1',
      Locale.de,
    );

    expect(res.message).toBe('Nothing to clear');
  });

  it('records a clear mark so the AI cannot re-create the deleted row', async () => {
    // `Faq` is NOT NULL, so the clear removed the row. Nothing else records
    // that this locale is meant to stay blank.
    const faq = {
      findMany: jest.fn().mockResolvedValue(existingGroup),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const marks = clearMarks();
    const service = new FaqGroupService(
      { faq } as never,
      { enqueue: jest.fn(), enqueueForPageType: jest.fn() } as never,
      marks as never,
    );

    await service.deleteTranslation(FaqPageType.hub, 'h1', 'g1', Locale.nl);

    expect(marks.markForPageType).toHaveBeenCalledWith(
      FaqPageType.hub,
      'h1',
      'faq:g1',
      Locale.nl,
    );
  });

  it('never re-queues AI translation - a clear must stay cleared', async () => {
    const faq = {
      findMany: jest.fn().mockResolvedValue(existingGroup),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const enqueuer = { enqueue: jest.fn(), enqueueForPageType: jest.fn() };
    const service = new FaqGroupService(
      { faq } as never,
      enqueuer as never,
      clearMarks() as never,
    );

    await service.deleteTranslation(FaqPageType.hub, 'h1', 'g1', Locale.fr);

    expect(enqueuer.enqueueForPageType).not.toHaveBeenCalled();
    expect(enqueuer.enqueue).not.toHaveBeenCalled();
  });
});
