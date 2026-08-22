// Standalone runner for JUST the operator-conditions content (Pastel #80 /
// MCK-20), so production can be brought up to date without re-running the
// whole demo graph:
//
//   pnpm prisma:seed:operator-terms            # fill gaps only (safe default)
//   pnpm prisma:seed:operator-terms --force    # overwrite existing values too
//
// What it writes, from the same single source of truth the demo seed uses
// (prisma/demo/users-operators.ts + prisma/demo/tours.ts):
//   1. operators.slug        - backfilled from the demo key when NULL (the
//                              canonical /{locale}/operators/{slug}/conditions
//                              URL needs it; never overwrites a different slug)
//   2. operators.termsDocument/termsVersion/termsEffectiveDate - the operator
//                              conditions DOCUMENT (per-locale sanitized HTML)
//   3. tours.operatorTermsKind/acknowledgmentItems - which tours are flagged
//                              and their per-locale participation facts
//
// IDEMPOTENT and PRODUCTION-SAFE by default: a value an operator (or admin)
// already wrote is NEVER touched without --force - operators author their own
// document from the wizard now, and a seed must not silently revert it.
// Exception: --force never touches an existing DIFFERENT slug - renaming a
// canonical public URL is never a seed's call.

import { Prisma } from '@prisma/client';
import { prisma } from './demo/_shared';
import { OPERATORS, operatorEmail } from './demo/users-operators';
import { TOUR_BLUEPRINTS } from './demo/tours';

const force = process.argv.includes('--force');

async function seedOperators() {
  for (const op of OPERATORS) {
    // IMMUTABLE identity only: the demo login email (stable across
    // environments) or an already-set slug (unique, never operator-written).
    // Never companyName - any invited operator can rename their own company
    // to a value from this public repo and hijack the slug + document write
    // (security review). More than one match is ambiguous: skip, never guess.
    const matches = await prisma.operator.findMany({
      where: {
        OR: [{ slug: op.key }, { user: { email: operatorEmail(op.key) } }],
      },
      select: { id: true, slug: true, termsDocument: true },
    });
    if (matches.length === 0) {
      console.log(`- operator "${op.companyName}" not found - skipped`);
      continue;
    }
    if (matches.length > 1) {
      console.log(
        `- operator "${op.companyName}" matches ${matches.length} rows (${matches
          .map((m) => m.id)
          .join(', ')}) - ambiguous, skipped`,
      );
      continue;
    }
    const operator = matches[0];

    const data: Prisma.OperatorUpdateInput = {};
    if (!operator.slug) data.slug = op.key;
    else if (operator.slug !== op.key) {
      console.log(
        `- ${op.companyName}: keeping existing slug "${operator.slug}"`,
      );
    }

    if (op.terms && (force || operator.termsDocument == null)) {
      data.termsDocument = op.terms.document;
      data.termsVersion = op.terms.version;
      data.termsEffectiveDate = new Date();
    } else if (op.terms) {
      console.log(
        `- ${op.companyName}: conditions document already on file - kept (use --force to overwrite)`,
      );
    }

    if (Object.keys(data).length === 0) continue;
    await prisma.operator.update({ where: { id: operator.id }, data });
    console.log(`✓ ${op.companyName}: ${Object.keys(data).join(', ')} written`);
  }
}

async function seedTourFlags() {
  for (const bp of TOUR_BLUEPRINTS) {
    if (!bp.operatorTermsKind) continue;
    const tours = await prisma.tour.findMany({
      where: { slug: bp.slug },
      select: { id: true, slug: true, operatorTermsKind: true },
    });
    if (tours.length === 0) {
      console.log(`- tour "${bp.slug}" not found - skipped`);
      continue;
    }
    if (tours.length > 1) {
      // slug is unique per destination, not globally - refuse to guess.
      console.log(
        `- tour "${bp.slug}" matches ${tours.length} rows across destinations - skipped`,
      );
      continue;
    }
    const tour = tours[0];
    if (!force && tour.operatorTermsKind != null) {
      console.log(
        `- ${bp.slug}: conditions gate already set (${tour.operatorTermsKind}) - kept`,
      );
      continue;
    }
    await prisma.tour.update({
      where: { id: tour.id },
      data: {
        operatorTermsKind: bp.operatorTermsKind,
        acknowledgmentItems: bp.acknowledgmentItems ?? Prisma.DbNull,
      },
    });
    console.log(`✓ ${bp.slug}: ${bp.operatorTermsKind} gate written`);
  }
}

async function main() {
  if (force) console.log('--force: existing values WILL be overwritten\n');
  await seedOperators();
  await seedTourFlags();
  console.log(
    '\nDone. Public pages cache hourly - approved/instant document changes appear within the TTL.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
