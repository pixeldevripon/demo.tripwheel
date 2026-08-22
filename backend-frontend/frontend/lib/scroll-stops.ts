/**
 * Rest-position math for snap scrollers with a position indicator
 * (mck-16 §4.6). A scroller's marks (`[data-scroll-stop]` column offsets, or
 * page-width multiples when nothing is marked) are clamped to the reachable
 * range and collapsed: marks past the end of the scroll all come to rest at
 * `maxScroll`, so they are one stop - the dots must count REST POSITIONS, not
 * columns, or the last dot could never activate.
 */

/** Two stops closer than this are the same rest position (fractional device
 *  pixels make "equal" offsets differ by <1px). */
const SAME_STOP_PX = 2;
/** Below this much overflow the row effectively doesn't scroll - no stops,
 *  so the indicator hides. Matches the nudge hook's MIN_OVERFLOW. */
const MIN_OVERFLOW = 24;

/**
 * Collapse raw mark offsets into the scroller's real rest positions,
 * ascending. Returns `[]` when the row doesn't meaningfully scroll or only
 * one rest position exists (an indicator with one dot says nothing).
 */
export function resolveSnapStops(marks: number[], maxScroll: number): number[] {
    if (maxScroll < MIN_OVERFLOW) return [];
    const stops: number[] = [];
    for (const mark of [...marks].sort((a, b) => a - b)) {
        const stop = Math.min(Math.max(mark, 0), maxScroll);
        if (stops.length === 0 || stop - stops[stops.length - 1] > SAME_STOP_PX) {
            stops.push(stop);
        }
    }
    return stops.length > 1 ? stops : [];
}

/** Index of the rest position nearest to the current `scrollLeft`. */
export function nearestStopIndex(stops: number[], scrollLeft: number): number {
    let best = 0;
    for (let i = 1; i < stops.length; i++) {
        if (Math.abs(stops[i] - scrollLeft) < Math.abs(stops[best] - scrollLeft)) {
            best = i;
        }
    }
    return best;
}
