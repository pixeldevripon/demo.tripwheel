import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomScriptPosition } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

import { CustomScriptsService } from './custom-scripts.service';

describe('CustomScriptsService', () => {
  let service: CustomScriptsService;
  let prisma: {
    customScript: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      aggregate: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'script-1',
    name: 'Hotjar',
    description: null,
    position: CustomScriptPosition.BODY_END,
    code: '<script>a()</script>',
    isActive: true,
    displayOrder: 0,
    createdAt: new Date('2026-07-28T10:00:00.000Z'),
    updatedAt: new Date('2026-07-28T10:00:00.000Z'),
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      customScript: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(row()),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _max: { displayOrder: null } }),
        create: jest.fn().mockImplementation(({ data }) => row(data)),
        update: jest.fn().mockImplementation(({ data }) => row(data)),
        delete: jest.fn().mockResolvedValue(row()),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomScriptsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CustomScriptsService);
  });

  describe('getPublicScripts', () => {
    // The security-relevant one: an "off" snippet must never reach the payload.
    // Returning it with a false flag and trusting the frontend to skip it would
    // leave a switched-off vendor's code in the HTML of every page.
    it('filters inactive rows in the QUERY, not the response', async () => {
      await service.getPublicScripts();

      expect(prisma.customScript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('splits by position and ships PARSED nodes, never the raw blob', async () => {
      prisma.customScript.findMany.mockResolvedValue([
        { id: 'h1', code: '<script>head()</script>', position: 'HEAD' },
        { id: 'b1', code: '<script>body()</script>', position: 'BODY_END' },
        { id: 'h2', code: '<meta name="a" content="b">', position: 'HEAD' },
      ]);

      const result = await service.getPublicScripts();

      expect(result.head).toEqual([
        {
          id: 'h1',
          nodes: [{ tag: 'script', attributes: {}, html: 'head()' }],
        },
        {
          id: 'h2',
          nodes: [
            {
              tag: 'meta',
              attributes: { name: 'a', content: 'b' },
              html: null,
            },
          ],
        },
      ]);
      expect(result.bodyEnd).toEqual([
        {
          id: 'b1',
          nodes: [{ tag: 'script', attributes: {}, html: 'body()' }],
        },
      ]);
      // No name/isActive/timestamps leak into the public payload, and no `code`
      // - the frontend renders known tags, it never interpolates a string.
      expect(Object.keys(result.head[0])).toEqual(['id', 'nodes']);
    });

    it('drops a snippet that parses to nothing rather than emitting an empty one', async () => {
      prisma.customScript.findMany.mockResolvedValue([
        { id: 'x', code: '   ', position: 'HEAD' },
      ]);

      expect((await service.getPublicScripts()).head).toEqual([]);
    });

    it('reads in curated order', async () => {
      await service.getPublicScripts();

      const { orderBy } = prisma.customScript.findMany.mock.calls[0][0];
      expect(orderBy[0]).toEqual({ displayOrder: 'asc' });
    });
  });

  describe('create', () => {
    it('appends after the last script IN THE SAME POSITION', async () => {
      prisma.customScript.aggregate.mockResolvedValue({
        _max: { displayOrder: 4 },
      });

      await service.create(
        { name: 'Hotjar', code: '<script>a()</script>' },
        'admin-1',
      );

      expect(prisma.customScript.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { position: 'BODY_END' } }),
      );
      expect(
        prisma.customScript.create.mock.calls[0][0].data.displayOrder,
      ).toBe(5);
    });

    it('defaults to BODY_END - a new snippet must not delay first paint', async () => {
      await service.create({ name: 'x', code: '<script></script>' }, 'admin-1');

      expect(prisma.customScript.create.mock.calls[0][0].data.position).toBe(
        CustomScriptPosition.BODY_END,
      );
    });

    it('stores the code VERBATIM (no trim, no rewrite)', async () => {
      const code = '<script>\n  var a = 1;\n</script>\n';

      await service.create({ name: 'x', code }, 'admin-1');

      expect(prisma.customScript.create.mock.calls[0][0].data.code).toBe(code);
    });
  });

  describe('update', () => {
    it('404s on an unknown id', async () => {
      prisma.customScript.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nope', { isActive: false }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('writes only the provided fields', async () => {
      await service.update('script-1', { isActive: false }, 'admin-1');

      expect(prisma.customScript.update.mock.calls[0][0].data).toEqual({
        isActive: false,
      });
    });

    it('logs a code change distinctly from a rename', async () => {
      const log = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation(() => undefined);

      await service.update(
        'script-1',
        { code: '<script>b()</script>' },
        'admin-1',
      );
      expect(log.mock.calls[0][0]).toContain('CODE CHANGED');

      log.mockClear();
      await service.update('script-1', { name: 'Hotjar (prod)' }, 'admin-1');
      expect(log.mock.calls[0][0]).not.toContain('CODE CHANGED');
    });

    it('never logs the code itself', async () => {
      const log = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation(() => undefined);
      const secret = '<script>fetch("https://evil.example")</script>';

      await service.update('script-1', { code: secret }, 'admin-1');

      expect(log.mock.calls[0][0]).not.toContain('evil.example');
    });
  });

  describe('reorder', () => {
    it('rejects a duplicate id', async () => {
      await expect(
        service.reorder(
          {
            items: [
              { id: 'a', displayOrder: 0 },
              { id: 'a', displayOrder: 1 },
            ],
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a payload referencing a missing script', async () => {
      prisma.customScript.findMany.mockResolvedValue([{ id: 'a' }]);

      await expect(
        service.reorder(
          {
            items: [
              { id: 'a', displayOrder: 0 },
              { id: 'b', displayOrder: 1 },
            ],
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies the whole order in ONE transaction', async () => {
      prisma.customScript.findMany.mockResolvedValue([
        { id: 'a' },
        { id: 'b' },
      ]);

      await service.reorder(
        {
          items: [
            { id: 'a', displayOrder: 0 },
            { id: 'b', displayOrder: 1 },
          ],
        },
        'admin-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    });
  });

  describe('remove', () => {
    it('404s on an unknown id', async () => {
      prisma.customScript.findUnique.mockResolvedValue(null);

      await expect(service.remove('nope', 'admin-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
