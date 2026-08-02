import { describe, it, expect, vi } from 'vitest'
import { settleAll } from '@/lib/async/settle-all'

describe('settleAll (code-review M3/H2/M10)', () => {
  it('reports all successes', async () => {
    const r = await settleAll([1, 2, 3], async (n) => n * 2)
    expect(r.succeeded).toEqual([1, 2, 3])
    expect(r.failed).toEqual([])
  })

  it('splits partial failure instead of aborting the batch', async () => {
    const r = await settleAll([1, 2, 3, 4], async (n) => {
      if (n % 2 === 0) throw new Error(`fail ${n}`)
      return n
    })
    expect(r.succeeded).toEqual([1, 3])
    expect(r.failed.map((f) => f.item)).toEqual([2, 4])
    expect((r.failed[0].error as Error).message).toBe('fail 2')
  })

  it('captures total failure without rejecting', async () => {
    const r = await settleAll(['a', 'b'], async () => {
      throw new Error('nope')
    })
    expect(r.succeeded).toEqual([])
    expect(r.failed).toHaveLength(2)
  })

  it('runs every op even when one rejects (no short-circuit)', async () => {
    const seen: number[] = []
    await settleAll([1, 2, 3], async (n) => {
      seen.push(n)
      if (n === 1) throw new Error('x')
      return n
    })
    expect(seen.sort()).toEqual([1, 2, 3])
  })

  it('passes the index to op', async () => {
    const op = vi.fn(async () => undefined)
    await settleAll(['x', 'y'], op)
    expect(op).toHaveBeenNthCalledWith(1, 'x', 0)
    expect(op).toHaveBeenNthCalledWith(2, 'y', 1)
  })

  it('handles an empty list', async () => {
    const r = await settleAll([], async () => undefined)
    expect(r).toEqual({ succeeded: [], failed: [] })
  })
})
