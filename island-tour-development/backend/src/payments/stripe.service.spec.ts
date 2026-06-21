import { Prisma } from '@prisma/client';
import { toMinorUnits } from './stripe.service';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('toMinorUnits', () => {
  it('converts a 2dp Decimal to integer cents', () => {
    expect(toMinorUnits(D('41.99'))).toBe(4199);
    expect(toMinorUnits(D('209.97'))).toBe(20997);
    expect(toMinorUnits(D('0'))).toBe(0);
  });

  it('rounds HALF_UP at the cent boundary', () => {
    expect(toMinorUnits(D('1.005'))).toBe(101); // 100.5 → 101
  });
});
