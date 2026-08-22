import {
  selectNextAdventureTours,
  type NextAdventureCandidate,
} from './next-adventure-selection.util';

/**
 * G-15: the pure MK-1 card picker. Candidates arrive availability-filtered
 * in canonical listing order (tierRank ASC, qualityScore DESC, id ASC) with
 * the booked tour excluded — this spec pins the ROLE logic only: contrast /
 * adjacent / flagship, dedupe by construction, role fallback fills, and the
 * hard <3 → null bar (the sender turns null into `insufficient-open-tours`).
 */

const BOOKED_CAT = 'cat-water';
const OTHER_CAT = 'cat-land';
const THIRD_CAT = 'cat-culture';

function t(
  id: string,
  primaryCategoryId: string | null,
  qualityScore: number,
): NextAdventureCandidate {
  return { id, primaryCategoryId, qualityScore };
}

describe('selectNextAdventureTours', () => {
  it('picks contrast (different category), adjacent (same), flagship (top score of the rest) — in that display order', () => {
    const picked = selectNextAdventureTours(BOOKED_CAT, [
      t('adj-1', BOOKED_CAT, 80), // canonical best, but SAME category
      t('con-1', OTHER_CAT, 70), // first different category → contrast
      t('adj-2', BOOKED_CAT, 60),
      t('flag', THIRD_CAT, 95), // top score of what remains → flagship
      t('rest', OTHER_CAT, 50),
    ]);
    expect(picked?.map((p) => p.id)).toEqual(['con-1', 'adj-1', 'flag']);
  });

  it('never picks the same tour for two roles (dedupe by construction)', () => {
    // One OTHER_CAT tour with the highest score: it wins contrast, so
    // flagship must fall to the best of the REST, not reuse it.
    const picked = selectNextAdventureTours(BOOKED_CAT, [
      t('star', OTHER_CAT, 99),
      t('adj', BOOKED_CAT, 40),
      t('other', BOOKED_CAT, 70),
    ]);
    expect(picked?.map((p) => p.id)).toEqual(['star', 'adj', 'other']);
    expect(new Set(picked?.map((p) => p.id)).size).toBe(3);
  });

  it('fills an unfillable contrast role from canonical order (single-category destination)', () => {
    const picked = selectNextAdventureTours(BOOKED_CAT, [
      t('a', BOOKED_CAT, 50),
      t('b', BOOKED_CAT, 90),
      t('c', BOOKED_CAT, 70),
    ]);
    // adjacent = a (first same-category), flagship = b (top score of rest),
    // contrast falls back to the canonical front of what remains (c).
    expect(picked?.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('fills an unfillable adjacent role when nothing shares the booked category', () => {
    const picked = selectNextAdventureTours(BOOKED_CAT, [
      t('x', OTHER_CAT, 10),
      t('y', THIRD_CAT, 30),
      t('z', OTHER_CAT, 20),
    ]);
    // contrast = x, flagship = y (top of rest), adjacent falls back to z.
    expect(picked?.map((p) => p.id)).toEqual(['x', 'z', 'y']);
  });

  it('a booked tour with NO primary category fills all roles canonically around the flagship', () => {
    const picked = selectNextAdventureTours(null, [
      t('first', OTHER_CAT, 10),
      t('second', BOOKED_CAT, 90),
      t('third', null, 40),
      t('fourth', THIRD_CAT, 60),
    ]);
    // Contrast/adjacent are meaningless against null → flagship picks the
    // top score (second), fills take the canonical front (first, third).
    expect(picked?.map((p) => p.id)).toEqual(['first', 'third', 'second']);
  });

  it('candidates without a primary category can never satisfy contrast', () => {
    const picked = selectNextAdventureTours(BOOKED_CAT, [
      t('nocat', null, 99),
      t('adj', BOOKED_CAT, 10),
      t('con', OTHER_CAT, 20),
    ]);
    // nocat is not "a different category" — contrast must be con; nocat
    // still reaches the email, but as the flagship (top remaining score).
    expect(picked?.map((p) => p.id)).toEqual(['con', 'adj', 'nocat']);
  });

  it('flagship ties break toward canonical order (earlier = better ranked)', () => {
    const picked = selectNextAdventureTours(BOOKED_CAT, [
      t('con', OTHER_CAT, 10),
      t('adj', BOOKED_CAT, 10),
      t('tie-first', THIRD_CAT, 55),
      t('tie-second', THIRD_CAT, 55),
    ]);
    expect(picked?.map((p) => p.id)).toEqual(['con', 'adj', 'tie-first']);
  });

  it('returns null below three qualifying candidates — never pads (G-07)', () => {
    expect(selectNextAdventureTours(BOOKED_CAT, [])).toBeNull();
    expect(
      selectNextAdventureTours(BOOKED_CAT, [t('a', OTHER_CAT, 1)]),
    ).toBeNull();
    expect(
      selectNextAdventureTours(BOOKED_CAT, [
        t('a', OTHER_CAT, 1),
        t('b', BOOKED_CAT, 2),
      ]),
    ).toBeNull();
  });

  it('exactly three qualifying candidates always produce three cards', () => {
    const picked = selectNextAdventureTours(BOOKED_CAT, [
      t('a', null, 5),
      t('b', null, 15),
      t('c', null, 10),
    ]);
    expect(picked).not.toBeNull();
    expect(new Set(picked?.map((p) => p.id)).size).toBe(3);
  });

  it("does not mutate the caller's candidate array", () => {
    const candidates = [
      t('a', OTHER_CAT, 1),
      t('b', BOOKED_CAT, 2),
      t('c', THIRD_CAT, 3),
    ];
    const before = candidates.map((c) => c.id);
    selectNextAdventureTours(BOOKED_CAT, candidates);
    expect(candidates.map((c) => c.id)).toEqual(before);
  });
});
