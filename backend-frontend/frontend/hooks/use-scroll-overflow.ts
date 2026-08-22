import * as React from "react"

/** How much of the visible track one chevron press travels. */
const PAGE_FRACTION = 0.8

/**
 * Reports which side of a horizontally-scrolling element still hides content,
 * so edge fades and scroll buttons can be shown only while they mean something.
 *
 * Pass the ref of the element that actually overflows — the same one
 * `useDragScroll` returns, so one element gets both behaviours:
 *
 * @example
 *   const trackRef = useDragScroll<HTMLDivElement>()
 *   const { left, right, scrollByPage } = useScrollOverflow(trackRef)
 */
export function useScrollOverflow<T extends HTMLElement>(
  ref: React.RefObject<T | null>
) {
  const [overflow, setOverflow] = React.useState({ left: false, right: false })

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      // `scrollLeft` and `scrollWidth` are fractional under a fractional device
      // pixel ratio or browser zoom, so both ends need a 1px tolerance — at 1.25x
      // an element scrolled fully right sits at max - 0.4 and the fade would
      // never turn off.
      const max = el.scrollWidth - el.clientWidth
      const left = el.scrollLeft > 1
      const right = el.scrollLeft < max - 1
      setOverflow(prev =>
        prev.left === left && prev.right === right ? prev : { left, right }
      )
    }

    measure()
    el.addEventListener("scroll", measure, { passive: true })

    // The track resizes with the viewport, and its children resize when their
    // labels change (a locale switch swaps every word) — both move the right
    // edge without ever firing `scroll`.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)

    return () => {
      el.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [ref])

  /** Scroll one visible width (minus a sliver of overlap) in either direction. */
  const scrollByPage = React.useCallback(
    (direction: 1 | -1) => {
      const el = ref.current
      if (!el) return
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      el.scrollBy({
        left: direction * el.clientWidth * PAGE_FRACTION,
        behavior: reduceMotion ? "auto" : "smooth",
      })
    },
    [ref]
  )

  return { ...overflow, scrollByPage }
}
