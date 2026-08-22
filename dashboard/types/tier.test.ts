import { describe, it, expect } from 'vitest'
import { tierMeta, TIER_META } from '@/types/tier'
import type { TierKey } from '@/types/tier'

describe('tierMeta (code-review M7)', () => {
  it('returns the exact meta for every known tier', () => {
    ;(Object.keys(TIER_META) as TierKey[]).forEach((k) => {
      expect(tierMeta(k)).toBe(TIER_META[k])
    })
  })

  it('falls back to standard for an unknown tier (backend drift) instead of crashing', () => {
    // Simulates the backend sending a tier this enum does not know yet.
    const unknown = 'diamond' as unknown as TierKey
    expect(() => tierMeta(unknown).label).not.toThrow()
    expect(tierMeta(unknown)).toBe(TIER_META.standard)
  })

  it('never returns undefined', () => {
    const values: TierKey[] = ['premium', 'featured', 'boosted', 'organic', 'standard']
    for (const k of values) expect(tierMeta(k)).toBeDefined()
  })
})
