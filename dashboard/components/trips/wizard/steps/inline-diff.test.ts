import { describe, expect, it } from 'vitest';

import { diffWords } from './inline-diff';

describe('diffWords', () => {
    it('marks a single replaced word without disturbing its neighbours', () => {
        expect(
            diffWords('the best open bar', 'the best swim-up bar')
        ).toEqual([
            { type: 'same', text: 'the best' },
            { type: 'del', text: 'open' },
            { type: 'add', text: 'swim-up' },
            { type: 'same', text: 'bar' },
        ]);
    });

    it('a pure addition is one add span', () => {
        expect(diffWords('sunset cruise', 'sunset catamaran cruise')).toEqual([
            { type: 'same', text: 'sunset' },
            { type: 'add', text: 'catamaran' },
            { type: 'same', text: 'cruise' },
        ]);
    });

    it('empty current renders the whole proposal as added', () => {
        expect(diffWords('', 'brand new copy')).toEqual([
            { type: 'add', text: 'brand new copy' },
        ]);
    });

    it('empty proposal renders the whole current as removed (a clear)', () => {
        expect(diffWords('old note', '')).toEqual([
            { type: 'del', text: 'old note' },
        ]);
    });

    it('identical texts yield one same span', () => {
        expect(diffWords('unchanged text', 'unchanged text')).toEqual([
            { type: 'same', text: 'unchanged text' },
        ]);
    });
});
