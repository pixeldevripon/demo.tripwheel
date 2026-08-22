import { Locale } from '@prisma/client';
import { TranslationClearMarkService } from './translation-clear-mark.service';

/**
 * Clear marks are advisory bookkeeping for the AI pipeline. Two properties
 * matter: a mark must survive a clear (or the content comes back on the next
 * English edit), and a mark must never be able to fail the admin's request -
 * this table is not the thing they asked to change.
 */

function makeService(mark: Record<string, jest.Mock>) {
  return new TranslationClearMarkService({
    translationClearMark: mark,
  } as never);
}

describe('TranslationClearMarkService', () => {
  it('upserts one mark per (entity, unit, locale) - idempotent by construction', async () => {
    const mark = { upsert: jest.fn().mockResolvedValue({}) };
    const service = makeService(mark);

    await service.mark('hub', 'h1', 'faq:g1', Locale.nl, 'admin-1');

    expect(mark.upsert).toHaveBeenCalledWith({
      where: {
        entityType_entityId_unitKey_locale: {
          entityType: 'hub',
          entityId: 'h1',
          unitKey: 'faq:g1',
          locale: Locale.nl,
        },
      },
      create: {
        entityType: 'hub',
        entityId: 'h1',
        unitKey: 'faq:g1',
        locale: Locale.nl,
        clearedBy: 'admin-1',
      },
      update: { clearedBy: 'admin-1' },
    });
  });

  it('swallows a write failure - the clear itself already succeeded', async () => {
    const mark = { upsert: jest.fn().mockRejectedValue(new Error('db down')) };
    const service = makeService(mark);

    await expect(
      service.mark('hub', 'h1', 'faq:g1', Locale.nl),
    ).resolves.toBeUndefined();
  });

  it('ignores a page type with no entity mapping (tours have no FAQs)', async () => {
    const mark = { upsert: jest.fn() };
    const service = makeService(mark);

    await service.markForPageType('tour', 't1', 'faq:g1', Locale.nl);

    expect(mark.upsert).not.toHaveBeenCalled();
  });

  it('loads marks as lookup keys the registry can match unit by unit', async () => {
    const mark = {
      findMany: jest.fn().mockResolvedValue([
        { unitKey: 'faq:g1', locale: Locale.nl },
        { unitKey: 'main', locale: Locale.de },
      ]),
    };
    const service = makeService(mark);

    const marks = await service.loadFor('hub', 'h1');

    expect(marks.has('faq:g1@@nl')).toBe(true);
    expect(marks.has('main@@de')).toBe(true);
    expect(marks.has('faq:g1@@de')).toBe(false);
  });

  it('prunes only the pairs it is given, scoped to the entity', async () => {
    const mark = { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) };
    const service = makeService(mark);

    await service.forget('hub', 'h1', [
      { unitKey: 'faq:g1', locale: Locale.nl },
    ]);

    expect(mark.deleteMany).toHaveBeenCalledWith({
      where: {
        entityType: 'hub',
        entityId: 'h1',
        OR: [{ unitKey: 'faq:g1', locale: Locale.nl }],
      },
    });
  });

  it('does not hit the database when there is nothing to prune', async () => {
    const mark = { deleteMany: jest.fn() };
    const service = makeService(mark);

    await service.forget('hub', 'h1', []);

    expect(mark.deleteMany).not.toHaveBeenCalled();
  });
});
