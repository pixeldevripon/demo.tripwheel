// Standalone runner for JUST the default operator-team designations, so the
// backfill can be run without re-running the whole base seed:
//
//   pnpm prisma:seed:designations          # add missing templates everywhere
//   pnpm prisma:seed:designations:clean    # remove memberless seeded rows
//
// Idempotent: the (operatorId, name) unique + skipDuplicates + a
// case-insensitive pre-filter (mirroring the staff service's uniqueness rule)
// make re-runs no-ops. Rows an owner edited keep their name, so they are
// never touched. `--clean` only deletes SEEDED (isSystem, operator-scoped)
// rows that no member holds - a designation in use is skipped with a log,
// because deleting it would silently null the member's template.
//
// seed.ts calls the same seedTeamDesignations() as part of the full base
// seed; the PrismaClient is injected so each entrypoint keeps its single
// client per process.

import type { PrismaClient } from '@prisma/client';
import { defaultTeamDesignationRows } from '../src/config/team-designations.config';

export async function seedTeamDesignations(prisma: PrismaClient) {
  const operators = await prisma.operator.findMany({ select: { id: true } });
  if (operators.length === 0) {
    console.log('Team designations: no operators yet, nothing to backfill.');
    return;
  }

  const existing = await prisma.staffDesignation.findMany({
    where: { operatorId: { not: null } },
    select: { operatorId: true, name: true },
  });
  const taken = new Set(
    existing.map((row) => `${row.operatorId}:${row.name.toLowerCase()}`),
  );

  const rows = operators
    .flatMap((operator) => defaultTeamDesignationRows(operator.id))
    .filter((row) => !taken.has(`${row.operatorId}:${row.name.toLowerCase()}`));

  if (rows.length === 0) {
    console.log(
      `Team designations: all ${operators.length} operator(s) already covered.`,
    );
    return;
  }

  const result = await prisma.staffDesignation.createMany({
    data: rows,
    skipDuplicates: true,
  });
  console.log(
    `Team designations: added ${result.count} template row(s) across ${operators.length} operator(s).`,
  );
}

export async function cleanTeamDesignations(prisma: PrismaClient) {
  const inUse = await prisma.staffDesignation.count({
    where: {
      isSystem: true,
      operatorId: { not: null },
      members: { some: {} },
    },
  });
  if (inUse > 0) {
    console.log(
      `Team designations: keeping ${inUse} seeded row(s) that member(s) hold.`,
    );
  }

  const result = await prisma.staffDesignation.deleteMany({
    where: {
      isSystem: true,
      operatorId: { not: null },
      members: { none: {} },
    },
  });
  console.log(
    `Team designations: removed ${result.count} memberless seeded row(s).`,
  );
}

// Run direct (pnpm prisma:seed:designations[:clean]); imported by seed.ts.
// Lazy require (not a top-level import): seed.ts imports this module for the
// function alone, and must not instantiate _shared's PrismaClient beside its
// own. A dynamic import() would stay native ESM under ts-node and fail to
// resolve the extensionless TS path.
if (require.main === module) {
  void (async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prisma } = require('./demo/_shared') as {
      prisma: PrismaClient;
    };
    try {
      if (process.argv.includes('--clean')) {
        await cleanTeamDesignations(prisma);
      } else {
        await seedTeamDesignations(prisma);
      }
    } catch (e) {
      console.error(e);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  })();
}
