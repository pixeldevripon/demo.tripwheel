/**
 * MK-1 card selection (EMAIL-PROGRAMME-CHECKLIST G-06) — the PURE half.
 *
 * The service wrapper (`NextAdventureEmailsService.loadCards`) does the I/O:
 * it queries LIVE tours in the booking's destination that have an OPEN
 * departure inside the next 7 days (availability at send time — the
 * wireframe's "availability email, not a recommendation email" rule) and
 * hands them here in the platform's canonical listing order
 * (`tierRank ASC, qualityScore DESC, id ASC`), booked tour already excluded.
 *
 * This function only decides WHICH three of those qualify for the wireframe's
 * roles:
 *
 *   contrast  — first candidate whose primary category differs from the
 *               booked tour's ("you have been on the water, this is the land
 *               version")
 *   adjacent  — first candidate sharing the booked tour's primary category
 *               ("half the day of Klein Curaçao")
 *   flagship  — the highest `qualityScore` among the REMAINING candidates
 *               ("if you only do one more thing")
 *
 * Roles are a preference, not a gate: when a role cannot be filled (a
 * destination with one category has no contrast), the empty slot falls back
 * to the next-best candidate in canonical order — three qualifying tours
 * always produce three cards. Only the AVAILABILITY bar is hard: fewer than
 * three qualifying candidates returns null and the sender suppresses with
 * `insufficient-open-tours` (G-07) instead of padding the email.
 *
 * Dedupe is by construction — each pick is removed from the pool before the
 * next role is considered, so one tour can never fill two slots.
 */

export interface NextAdventureCandidate {
  id: string;
  /** The tour's PRIMARY category id; null when none is flagged primary. */
  primaryCategoryId: string | null;
  /** Tour.qualityScore as a number (Decimal callers convert). */
  qualityScore: number;
}

/**
 * Pick the three MK-1 cards from `candidates` (canonical order, booked tour
 * excluded, availability already verified). Returns the cards in display
 * order [contrast, adjacent, flagship] — with fallback fills keeping their
 * slot position — or null when fewer than three candidates qualify.
 */
export function selectNextAdventureTours<T extends NextAdventureCandidate>(
  bookedPrimaryCategoryId: string | null,
  candidates: readonly T[],
): [T, T, T] | null {
  if (candidates.length < 3) return null;

  const pool = [...candidates];
  const take = (index: number): T | null =>
    index === -1 ? null : pool.splice(index, 1)[0];

  // Contrast: a DIFFERENT primary category. When the booked tour has no
  // primary category on record, nothing can meaningfully "contrast" it, so
  // the role falls through to the canonical fill below.
  const contrast =
    bookedPrimaryCategoryId === null
      ? null
      : take(
          pool.findIndex(
            (t) =>
              t.primaryCategoryId !== null &&
              t.primaryCategoryId !== bookedPrimaryCategoryId,
          ),
        );

  // Adjacent: the SAME primary category as the booked tour.
  const adjacent =
    bookedPrimaryCategoryId === null
      ? null
      : take(
          pool.findIndex(
            (t) => t.primaryCategoryId === bookedPrimaryCategoryId,
          ),
        );

  // Flagship: highest qualityScore of what remains; canonical order breaks
  // ties (the pool arrives sorted qualityScore DESC within a tier, so the
  // strict `>` keeps the earliest — and therefore best-ranked — of equals).
  let flagshipIdx = -1;
  for (let i = 0; i < pool.length; i++) {
    if (
      flagshipIdx === -1 ||
      pool[i].qualityScore > pool[flagshipIdx].qualityScore
    ) {
      flagshipIdx = i;
    }
  }
  const flagship = take(flagshipIdx);

  // Fill any unfilled role from the canonical front of the pool. With >= 3
  // candidates the pool always covers the gaps (at most 3 - filled picks).
  const picks: (T | null)[] = [contrast, adjacent, flagship];
  for (let i = 0; i < picks.length; i++) {
    if (picks[i] === null) picks[i] = pool.shift() ?? null;
  }
  // length >= 3 guarantees every slot filled; the guard is for the compiler.
  if (picks.some((p) => p === null)) return null;
  return picks as [T, T, T];
}
