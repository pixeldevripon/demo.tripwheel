import * as React from "react"

/**
 * Makes a horizontally-overflowing container scrollable with a plain mouse.
 *
 * Our tab bars / filter rows hide their scrollbar and scroll fine via touch or
 * a trackpad, but a user with only a vertical-wheel mouse has no way to reach
 * overflowed items. This hook adds two affordances to the referenced element:
 *
 *   1. Drag-to-scroll ("swipe" with the pointer) — mouse/pen only, so native
 *      touch momentum scrolling is left completely untouched.
 *   2. Vertical wheel -> horizontal scroll, but only while there is horizontal
 *      overflow and we are not at an edge (so the page still scrolls at the ends).
 *
 * A 5px movement threshold distinguishes a click from a drag, and the click that
 * would follow a drag is suppressed so a swipe never activates a tab underneath.
 *
 * Attach the returned ref to the element that actually overflows (the one with
 * `overflow-x-auto`). No-ops when the content fits, so it is always safe to add.
 *
 * @example
 *   const ref = useDragScroll<HTMLDivElement>()
 *   return <div ref={ref} className="flex overflow-x-auto ...">{...}</div>
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    let isDown = false
    let moved = false
    let startX = 0
    let startScrollLeft = 0

    const canScroll = () => el.scrollWidth > el.clientWidth + 1

    const onPointerDown = (e: PointerEvent) => {
      // Mouse/pen only — touch already scrolls natively (don't hijack momentum).
      if (e.pointerType === "touch" || e.button !== 0 || !canScroll()) return
      isDown = true
      moved = false
      startX = e.clientX
      startScrollLeft = el.scrollLeft
      // Capture is claimed on the first real move, so plain clicks still reach triggers.
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) < 5) return // threshold: click vs drag
      if (!moved) {
        moved = true
        el.setPointerCapture(e.pointerId)
        el.style.cursor = "grabbing"
        el.style.userSelect = "none"
      }
      e.preventDefault()
      el.scrollLeft = startScrollLeft - dx
    }

    const endDrag = (e: PointerEvent) => {
      if (!isDown) return
      isDown = false
      if (moved) {
        try {
          el.releasePointerCapture(e.pointerId)
        } catch {
          /* pointer already released */
        }
        el.style.cursor = ""
        el.style.userSelect = ""
      }
    }

    // Swallow the synthetic click that fires after a drag so no tab activates.
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation()
        e.preventDefault()
        moved = false
      }
    }

    // Translate a vertical wheel into horizontal scroll, but yield to the page
    // once we hit either edge so normal vertical page scrolling still works.
    const onWheel = (e: WheelEvent) => {
      if (!canScroll() || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }

    el.addEventListener("pointerdown", onPointerDown)
    el.addEventListener("pointermove", onPointerMove)
    el.addEventListener("pointerup", endDrag)
    el.addEventListener("pointercancel", endDrag)
    el.addEventListener("click", onClickCapture, true) // capture phase
    el.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("pointermove", onPointerMove)
      el.removeEventListener("pointerup", endDrag)
      el.removeEventListener("pointercancel", endDrag)
      el.removeEventListener("click", onClickCapture, true)
      el.removeEventListener("wheel", onWheel)
    }
  }, [])

  return ref
}
