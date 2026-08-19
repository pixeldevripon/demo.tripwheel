/**
 * The Submissions queue row (client review #18): the publish gate's
 * spotting surface. The contract pinned here is the one the nav badge
 * depends on - the URL filter, the badge key, and the reviewer-only
 * permission must stay in lockstep or the badge promises work the click
 * does not show.
 */
import { describe, expect, it } from 'vitest'
import { Permission } from '@/lib/config/rbac'
import { getNavigations } from './navigations'

describe('Submissions nav row', () => {
  const item = getNavigations()
    .dashboard.flatMap(g => g.items)
    .find(i => i.title === 'Submissions')

  it('is an independent page gated on the reviewer permission', () => {
    expect(item).toBeDefined()
    // Its own route (client 2026-08-15: not a filtered Tours link).
    // NAV_BADGES keys off this exact string - change both together.
    expect(item?.url).toBe('submissions')
    expect(item?.permissions).toEqual([Permission.VIEW_TRIPS])
  })
})
