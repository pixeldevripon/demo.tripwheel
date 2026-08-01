// Guards the default operator-team designation templates
// (src/config/team-designations.config.ts). The rows are written to the DB
// outside the staff service's assertWithinCeiling path (operator create +
// seed backfill), so this spec is what keeps them inside the seat grant
// ceiling instead of relying on the engine silently dropping the excess.

import { Permission } from '@prisma/client';
import { OPERATOR_SEAT_CEILING } from '@/config/staff.config';
import { DEFAULT_TEAM_DESIGNATIONS } from '@/config/team-designations.config';

describe('team-designations.config', () => {
  it('every template permission sits inside OPERATOR_SEAT_CEILING', () => {
    for (const template of DEFAULT_TEAM_DESIGNATIONS) {
      const outside = template.permissions.filter(
        (p) => !OPERATOR_SEAT_CEILING.includes(p),
      );
      expect({ name: template.name, outside }).toEqual({
        name: template.name,
        outside: [],
      });
    }
  });

  it('never grants the owner-only permissions', () => {
    for (const template of DEFAULT_TEAM_DESIGNATIONS) {
      expect(template.permissions).not.toContain(Permission.MANAGE_TEAM);
      expect(template.permissions).not.toContain(
        Permission.MANAGE_OPERATOR_PAYMENTS,
      );
    }
  });

  it('template names are unique (compound unique is (operatorId, name))', () => {
    const names = DEFAULT_TEAM_DESIGNATIONS.map((t) => t.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('no template repeats a permission (createMany writes arrays verbatim)', () => {
    for (const template of DEFAULT_TEAM_DESIGNATIONS) {
      expect(new Set(template.permissions).size).toBe(
        template.permissions.length,
      );
    }
  });

  it('Guide stays a manifest-level grant (conflict #7: no financials)', () => {
    const guide = DEFAULT_TEAM_DESIGNATIONS.find((t) => t.name === 'Guide');
    expect(guide).toBeDefined();
    expect(guide?.permissions).toContain(Permission.VIEW_BOOKINGS);
    expect(guide?.permissions).not.toContain(
      Permission.VIEW_BOOKING_FINANCIALS,
    );
  });
});
