import { describe, expect, it } from 'vitest';
import { describeFailures } from './trip-schedules-tab';

/**
 * A failed schedule create has to say WHY.
 *
 * The form used to report a bare count ("2 could not be added"), which cannot
 * tell an operator whether they picked a day that already has that time -
 * deselect it and move on - or whether the API is down, which no amount of
 * adjusting the form will fix. On 2026-08-08 an unapplied migration made every
 * call 500 and the count reported it as an ordinary partial failure, so the
 * operator retried a form that could not succeed.
 */
const fail = (weekday: number, startTime: string, message: string) => ({
    item: { weekday, startTime },
    error: new Error(message),
});

describe('describeFailures', () => {
    it("passes the server's own message through", () => {
        const out = describeFailures([
            fail(
                0,
                '13:00',
                'A schedule for Monday at 13:00 already exists for this tour.',
            ),
        ]);
        expect(out).toBe(
            'A schedule for Monday at 13:00 already exists for this tour.',
        );
    });

    it('collapses rows that failed the same way into one fact', () => {
        // Twelve rows down for one reason is one thing to fix, not twelve.
        const out = describeFailures([
            fail(0, '20:00', 'Internal server error'),
            fail(1, '20:00', 'Internal server error'),
        ]);
        expect(out).toBe('Monday 20:00, Tuesday 20:00: Internal server error');
        expect(out.match(/Internal server error/g)).toHaveLength(1);
    });

    it('keeps distinct reasons apart', () => {
        const out = describeFailures([
            fail(
                0,
                '13:00',
                'A schedule for Monday at 13:00 already exists for this tour.',
            ),
            fail(4, '20:00', 'Internal server error'),
        ]);
        expect(out).toContain('already exists');
        expect(out).toContain('Friday 20:00: Internal server error');
    });

    it('names the combination when the message does not', () => {
        const out = describeFailures([fail(5, '07:00', 'Something went wrong')]);
        expect(out).toBe('Saturday 07:00: Something went wrong');
    });

    it('says so plainly when the server said nothing', () => {
        const out = describeFailures([
            { item: { weekday: 2, startTime: '09:00' }, error: undefined },
        ]);
        expect(out).toBe('Wednesday 09:00: The server did not say why.');
    });
});
